"""sse.py — Server-Sent Events framing + the per-lifecycle stream generators.

Split out of ``main.py`` (Slice 2) to keep the app entry point within the
~300-line cap once the session-auth middleware landed. This is pure transport
glue: it formats event frames and drives each lifecycle's async event stream.

The LLM-backend factory stays in ``main.py`` (the strategy-pattern rule:
"one branch in main.py's factory"). ``_stream_events`` receives it as a
callable rather than importing it, so this module never names a provider and
there is no ``main`` ⇄ ``sse`` import cycle.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable
from typing import TYPE_CHECKING

from agents.generate import run_pipeline
from agents.initial_pa_graph import run_initial_pa_pipeline
from agents.resume import run_resume
from models.schemas import (
    AppealEvent,
    AppealRequest,
    ErrorEvent,
    InitialPaEvent,
    InitialPaRequest,
    ResumeAppealRequest,
)

if TYPE_CHECKING:
    from ml.llm_backend import LLMBackend

logger = logging.getLogger(__name__)


def sse_line(event: AppealEvent | InitialPaEvent) -> str:
    """Format a single SSE message frame."""
    return f"event: {event.event}\ndata: {event.model_dump_json()}\n\n"


async def stream_events(
    request: AppealRequest, build_backend: Callable[[], LLMBackend]
) -> AsyncIterator[str]:
    # SSE headers are already sent when this generator runs — a construction
    # failure must surface as an error event, never a bare disconnect.
    try:
        llm_backend = build_backend()
    except Exception:
        logger.exception("LLM backend construction failed")
        yield sse_line(
            ErrorEvent(message="Server LLM backend is not configured.", retry_count=0)
        )
        return
    async for event in run_pipeline(request, llm_backend=llm_backend):
        yield sse_line(event)


async def stream_initial_pa_events(request: InitialPaRequest) -> AsyncIterator[str]:
    # No LLM backend construction — the initial-PA path never invokes a model,
    # so the route must serve without LLM_BACKEND being set.
    async for event in run_initial_pa_pipeline(request):
        yield sse_line(event)


async def stream_resume_events(
    request: ResumeAppealRequest, reviewed_by: str
) -> AsyncIterator[str]:
    # Resume re-enters a parked graph at the hold node (Slice 4b) — no LLM is
    # invoked (no synthesis re-run), so this route serves without LLM_BACKEND.
    # reviewed_by is the session user who cleared the run ("" for a Bearer /
    # service caller) — recorded on the resume audit entry (ADR-0013).
    async for event in run_resume(
        request.correlation_id, request.edited_text, reviewed_by=reviewed_by
    ):
        yield sse_line(event)
