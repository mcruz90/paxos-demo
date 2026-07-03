"""audit/boundary.py — terminal-event interception at the pipeline boundary.

Shared by both lifecycle graphs (appeal + initial-PA): stamps the
correlation_id onto the terminal event and writes the AuditRecord BEFORE the
event is yielded to the client (ACID §Durability — persisted before `done`).

An audit-write failure must never break the stream contract (the terminal
event still reaches the client); it is logged loudly server-side instead.
With the in-memory store this is effectively unreachable; the durable-store
milestone revisits whether a failed write should convert the terminal to an
error (ADR-0009).
"""

from __future__ import annotations

import logging
import time
from collections.abc import AsyncIterator, Callable
from typing import Any

from audit.store import write_audit_record
from models.schemas import AuditRecord

logger = logging.getLogger(__name__)

_TERMINAL_EVENTS = ("done", "error")


async def with_audit(
    events: AsyncIterator[Any],
    *,
    correlation_id: str,
    build_record: Callable[[Any, int], AuditRecord],
) -> AsyncIterator[Any]:
    """Forward *events*, stamping + auditing the terminal one.

    Args:
        events: The pipeline's event stream (guaranteed to end with exactly
            one ``done`` or ``error`` event).
        correlation_id: The logical run's ID (ADR-0009).
        build_record: Lifecycle-specific record builder — receives the
            stamped terminal event and the run duration in ms.

    Yields:
        The events unchanged, except the terminal event carries
        ``correlation_id`` and is preceded by the audit write.
    """
    started = time.monotonic()
    async for event in events:
        if event.event in _TERMINAL_EVENTS:
            event = event.model_copy(update={"correlation_id": correlation_id})
            duration_ms = int((time.monotonic() - started) * 1000)
            try:
                write_audit_record(build_record(event, duration_ms))
            except Exception:
                logger.exception("audit write failed for correlation_id=%s", correlation_id)
        yield event
