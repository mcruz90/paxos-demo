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

import hashlib
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
    """Apply a human review to the parked draft and audit its gate verdict.

    Rejected edits leave the original draft available for another review.
    An unknown or completed reference returns an error without an audit write.
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
        key = idempotency_key
        if isinstance(event, ErrorEvent) and event.resume_gate == "edit_failed" and edited_text:
            # Identical rejected edits deduplicate without consuming the eventual sign-off key.
            digest = hashlib.sha256(edited_text.encode()).hexdigest()
            key = f"{key}:rejected:{digest}"
        return build_audit_record(
            event=event,
            duration_ms=duration_ms,
            correlation_id=correlation_id,
            idempotency_key=key,
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
    """Resume the checkpointed graph and forward its terminal event.

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
