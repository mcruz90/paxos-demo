"""agents/generate.py — the appeal generation entrypoint (run_pipeline).

Like [agents/resume.py](resume.py), this is a *client* of the compiled
``_PIPELINE`` singleton defined in [agents/graph.py](graph.py): it drives a
fresh appeal run from an :class:`AppealRequest` to a terminal ``done``/``error``
event, wrapping the graph stream in the audit boundary and the security-hold
gate. The graph definition, node wrappers, and ``_PIPELINE`` stay in
``graph.py`` — this module imports the singleton, never rebuilds it.

Split out of ``graph.py`` so the graph-definition module stays within the
CLAUDE.md size limit and so the two entrypoints (generate, resume) sit
symmetrically beside the graph they both drive.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast

from langchain_core.runnables import RunnableConfig

from agents.graph import _PIPELINE
from audit.boundary import with_audit
from audit.ids import (
    derive_case_id,
    derive_correlation_id,
    derive_idempotency_key,
)
from models.schemas import (
    AppealEvent,
    AppealRequest,
    AuditProvenance,
    AuditRecord,
    CaseLifecycle,
    DoneEvent,
    ErrorEvent,
)

logger = logging.getLogger(__name__)


async def run_pipeline(
    request: AppealRequest,
    llm_backend,
) -> AsyncIterator[AppealEvent]:
    """Execute the appeal generation pipeline and yield SSE events.

    Boundary contract: every stream terminates with a ``done`` or ``error``
    event, the terminal event carries the run's ``correlation_id``, and
    exactly one :class:`AuditRecord` is written before the terminal event is
    yielded (idempotent on case + attempt — a transport retry never
    double-writes; ADR-0009).

    Args:
        request: A fully-validated :class:`AppealRequest`.
        llm_backend: LLM backend implementing ``generate`` and
            ``generate_stream``. Injected for testability.

    Yields:
        :class:`StepEvent`, :class:`ChunkEvent`, :class:`DoneEvent`,
        or :class:`ErrorEvent` objects.
    """
    # AppealRequest carries no case_ref; scenario_id is the case identity.
    case_id = derive_case_id("", request.scenario_id)
    correlation_id = derive_correlation_id(case_id, request.attempt)
    idempotency_key = derive_idempotency_key(case_id, request.attempt)

    def build_record(event: AppealEvent, duration_ms: int) -> AuditRecord:
        done = event if isinstance(event, DoneEvent) else None
        error = event if isinstance(event, ErrorEvent) else None
        return AuditRecord(
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            lifecycle=CaseLifecycle.appeal,
            scenario_id=request.scenario_id,
            drug=request.drug,
            plan=request.plan,
            denial_reason=request.denial_reason,
            timestamp=datetime.now(UTC).isoformat(),
            duration_ms=duration_ms,
            outcome="done" if done else "error",
            model_name=done.model if done else getattr(llm_backend, "model_name", ""),
            artifact_ref=done.ref if done else "",
            gatekeeper_passed=done is not None,
            retry_count=done.retry_count if done else (error.retry_count if error else 0),
            structural_eval_scores=done.structural_scores if done else {},
            pa_resolution=done.pa_resolution if done else "",
            # The HITL review tier (S3 Slice 3). None on error: no letter was
            # produced, so there is no artifact to route to a review surface.
            tier=done.tier if done else None,
            # No gatekeeper-correction or human-edit path exists yet — every
            # pipeline-boundary artifact is machine output as-is.
            provenance=AuditProvenance.as_is,
        )

    async for event in with_audit(
        _generate_events(request, llm_backend, thread_id=correlation_id),
        correlation_id=correlation_id,
        build_record=build_record,
    ):
        yield event


async def _generate_events(
    request: AppealRequest,
    llm_backend,
    *,
    thread_id: str,
) -> AsyncIterator[AppealEvent]:
    """Pipeline event stream: security gate → graph run → guaranteed terminal.

    A node exception must never propagate out of this generator, because SSE
    headers are already sent and the client would see a bare disconnect with
    no event. This is the one deliberate broad catch in the pipeline: it
    converts failures at the API boundary, it does not hide them (full detail
    is logged server-side; the client gets a generic message).

    ``thread_id`` (= correlation_id) keys the run's checkpoint so an
    exception-tier run can park at an interrupt and be resumed (S3 Slice 4a).
    An exception run streams its terminal DoneEvent from ``finalize`` and then
    parks at ``hold``; the astream iterator ends cleanly (the interrupt
    surfaces on the ``updates`` channel, which ``stream_mode="custom"`` does
    not forward), so the client sees a normal ``done`` terminal.
    """
    try:
        # --- security hold enforcement (before any node runs) ---
        # The ETL sets security_hold when a source document is flagged
        # (injection phrases, bidi chars, hidden PDF text). A held request must
        # never reach the LLM — this is the single downstream enforcement point
        # for that flag.
        if request.security_hold:
            reason = request.security_reason or "suspicious content detected in source document"
            yield ErrorEvent(
                message=f"Request blocked by security hold: {reason}",
                retry_count=0,
            )
            return

        config: RunnableConfig = {
            "configurable": {"llm_backend": llm_backend, "thread_id": thread_id}
        }
        async for event in _PIPELINE.astream(
            {"request": request}, config=config, stream_mode="custom"
        ):
            # stream_mode="custom" yields exactly what the node wrappers wrote,
            # which is always an AppealEvent; the astream stub types it loosely.
            yield cast(AppealEvent, event)
    except Exception:
        # Log identifiers only — never request/letter text (PHI rule).
        logger.exception("pipeline failed for scenario_id=%s", request.scenario_id)
        yield ErrorEvent(
            message="Appeal generation failed due to an internal error.",
            retry_count=0,
        )
