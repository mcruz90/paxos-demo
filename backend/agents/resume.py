"""agents/resume.py — the resume saga for parked exception-tier runs (S3 Slice 4b).

The appeal graph itself (definition, node wrappers, compiled ``_PIPELINE``
singleton with its ``InMemorySaver`` checkpointer) lives in
[agents/graph.py](graph.py). Resume is a *client* of that compiled graph, the
same way ``run_pipeline`` is: it re-enters the already-checkpointed run parked
at ``hold`` and drives it to a terminal ``done``. It is split out from
``graph.py`` because it is a distinct responsibility (the human-review saga vs.
the generate pipeline), and to keep both files within the CLAUDE.md size limit.

``_PIPELINE`` and the shared ``_build_done_event`` (used by ``finalize`` and
``resume_finalize``) stay in ``graph.py`` — this module imports the singleton,
never rebuilds or duplicates it.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from agents.graph import _PIPELINE
from audit.boundary import with_audit
from audit.ids import derive_resume_idempotency_key
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


async def run_resume(
    correlation_id: str,
    edited_text: str | None,
) -> AsyncIterator[AppealEvent]:
    """Resume a parked exception-tier run for a human reviewer (S3 Slice 4b).

    Drives the checkpointed run (parked at ``hold`` by Slice 4a) from
    ``correlation_id`` — its ``thread_id`` — to a ``done`` terminal, applying
    ``edited_text`` if the reviewer changed the letter. Writes a DISTINCT audit
    record (``provenance=human_edited``, ``idempotency_key=<corr>:resume``,
    same ``correlation_id``) so the trail keeps both the machine draft and the
    human sign-off.

    Args:
        correlation_id: The parked run's handle (from its terminal DoneEvent).
        edited_text: Human-edited letter body, or None to clear the draft as-is.

    Yields:
        :class:`DoneEvent` on success, or :class:`ErrorEvent` if nothing is
        awaiting review for ``correlation_id`` (unknown, or already resumed).
    """
    config: RunnableConfig = {"configurable": {"thread_id": correlation_id}}
    snapshot = _PIPELINE.get_state(config)

    # Not parked: unknown correlation_id, or the run already resumed/completed.
    # This is a client error, not a pipeline run — a terminal error, no audit.
    if not snapshot.next:
        yield ErrorEvent(
            message="No appeal is awaiting human review for this reference.",
            correlation_id=correlation_id,
        )
        return

    request: AppealRequest = snapshot.values["request"]
    idempotency_key = derive_resume_idempotency_key(correlation_id)

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
            model_name=done.model if done else "",
            artifact_ref=done.ref if done else "",
            gatekeeper_passed=done is not None,
            retry_count=done.retry_count if done else (error.retry_count if error else 0),
            structural_eval_scores=done.structural_scores if done else {},
            pa_resolution=done.pa_resolution if done else "",
            tier=done.tier if done else None,
            # A human reviewed (and possibly edited) the letter before it was
            # cleared for submission — the accountability record of that review.
            provenance=AuditProvenance.human_edited,
        )

    async for event in with_audit(
        _resume_events(config, edited_text, correlation_id),
        correlation_id=correlation_id,
        build_record=build_record,
    ):
        yield event


async def _resume_events(
    config: RunnableConfig,
    edited_text: str | None,
    correlation_id: str,
) -> AsyncIterator[AppealEvent]:
    """Resume the checkpointed graph and forward its terminal DoneEvent.

    Same guaranteed-terminal discipline as ``_generate_events``: a node
    exception is converted to a terminal ``error`` rather than escaping the
    generator (SSE headers are already sent).
    """
    try:
        async for event in _PIPELINE.astream(
            Command(resume={"edited_text": edited_text}),
            config=config,
            stream_mode="custom",
        ):
            yield cast(AppealEvent, event)
    except Exception:
        logger.exception("resume failed for correlation_id=%s", correlation_id)
        yield ErrorEvent(
            message="Appeal resume failed due to an internal error.",
            correlation_id=correlation_id,
        )
