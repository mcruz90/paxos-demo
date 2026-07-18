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
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from agents.graph import _PIPELINE
from audit.boundary import with_audit
from audit.ids import derive_resume_idempotency_key
from audit.records import build_audit_record
from models.schemas import (
    AppealEvent,
    AppealRequest,
    AuditProvenance,
    AuditRecord,
    ErrorEvent,
)

logger = logging.getLogger(__name__)


def resume_provenance(edited_text: str | None, draft: str) -> AuditProvenance:
    """Provenance of a resumed run's outbound artifact (May's ruling 2026-07-18).

    Approving the machine draft unchanged is a human *decision*, not an edit:
    falsy ``edited_text`` (the hold node keeps the draft) or text byte-identical
    to the parked draft is ``human_approved``; only actually-changed text is
    ``human_edited``. Pure so the honesty rule is unit-testable.
    """
    if not edited_text or edited_text == draft:
        return AuditProvenance.human_approved
    return AuditProvenance.human_edited


async def run_resume(
    correlation_id: str,
    edited_text: str | None,
    reviewed_by: str = "",
) -> AsyncIterator[AppealEvent]:
    """Resume a parked exception-tier run for a human reviewer (S3 Slice 4b).

    Drives the checkpointed run (parked at ``hold`` by Slice 4a) from
    ``correlation_id`` — its ``thread_id`` — to a ``done`` terminal, applying
    ``edited_text`` if the reviewer changed the letter. Writes a DISTINCT audit
    record (``idempotency_key=<corr>:resume``, same ``correlation_id``) so the
    trail keeps both the machine draft and the human sign-off; its provenance
    is ``resume_provenance``'s call — ``human_approved`` for an unchanged
    draft, ``human_edited`` for changed text.

    Args:
        correlation_id: The parked run's handle (from its terminal DoneEvent).
        edited_text: Human-edited letter body, or None to clear the draft as-is.
        reviewed_by: Session user_id of the human who cleared the run, stamped on
            the resume audit record. "" for a Bearer/service caller (no named
            reviewer — the service identity, ADR-0013).

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
    provenance = resume_provenance(edited_text, snapshot.values.get("appeal_text", ""))

    def build_record(event: AppealEvent, duration_ms: int) -> AuditRecord:
        # A human reviewed the letter before it was cleared for submission —
        # the accountability record of that review, with provenance saying
        # whether they approved it unchanged or actually edited it. The resume
        # path invokes no model, so the error model_name fallback is "" (the
        # default in audit/records.py).
        return build_audit_record(
            event=event,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            request=request,
            provenance=provenance,
            reviewed_by=reviewed_by,
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
