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
from typing import cast

from langchain_core.runnables import RunnableConfig

from agents.graph import _PIPELINE
from audit.boundary import with_audit
from audit.ids import (
    derive_case_id,
    derive_correlation_id,
    derive_idempotency_key,
)
from audit.records import build_audit_record
from models.schemas import (
    AppealEvent,
    AppealRequest,
    AuditProvenance,
    AuditRecord,
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
        # Every pipeline-boundary artifact is machine output as-is (no
        # gatekeeper-correction or human-edit path runs here); an error terminal
        # records the generating backend's name (audit/records.py).
        return build_audit_record(
            event=event,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            request=request,
            provenance=AuditProvenance.as_is,
            model_name_fallback=getattr(llm_backend, "model_name", ""),
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

        # --- re-entry guard (inverse of resume's parked-check) ---
        # This thread may already be parked at the `hold` interrupt from an
        # earlier exception-tier run (same correlation_id ⇒ same thread). Streaming
        # fresh input restarts from START, orphaning that checkpoint and breaking
        # ADR-0010's durable-pause guarantee — and a later resume by the old
        # correlation_id would then drive the WRONG run. Refuse instead: resume it,
        # or resubmit under a higher `attempt` (a new correlation_id, ADR-0009).
        if _PIPELINE.get_state(config).next:
            yield ErrorEvent(
                message=(
                    "This case is parked awaiting human review; resume it or "
                    "resubmit with a higher attempt."
                ),
                retry_count=0,
            )
            return

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
