"""agents/graph.py — LangGraph-style pipeline orchestrator.

Runs the 4-node DAG:
    ingestion → retrieval → synthesis → gatekeeper

Emits SSE-compatible AppealEvent objects as an async generator.
Retries the synthesis→gatekeeper cycle up to MAX_RETRIES times.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import AsyncIterator

from agents.nodes.gatekeeper import run_gatekeeper
from agents.nodes.ingestion import run_ingestion
from agents.nodes.retrieval import run_retrieval
from agents.nodes.synthesis import apply_synthesis, build_prompt
from evals.appeal_evals import eval_structural
from models.schemas import (
    AppealEvent,
    AppealRequest,
    ChunkEvent,
    DoneEvent,
    ErrorEvent,
    StepEvent,
)

MAX_RETRIES = 3

logger = logging.getLogger(__name__)


async def run_pipeline(
    request: AppealRequest,
    llm_backend,
) -> AsyncIterator[AppealEvent]:
    """Execute the appeal generation pipeline and yield SSE events.

    Boundary contract: every stream terminates with a ``done`` or ``error``
    event — a node exception must never propagate out of this generator,
    because SSE headers are already sent and the client would see a bare
    disconnect with no event. This is the one deliberate broad catch in the
    pipeline: it converts failures at the API boundary, it does not hide them
    (full detail is logged server-side; the client gets a generic message).

    Args:
        request: A fully-validated :class:`AppealRequest`.
        llm_backend: LLM backend implementing ``generate`` and
            ``generate_stream``. Injected for testability.

    Yields:
        :class:`StepEvent`, :class:`ChunkEvent`, :class:`DoneEvent`,
        or :class:`ErrorEvent` objects.
    """
    try:
        async for event in _run_pipeline_inner(request, llm_backend):
            yield event
    except Exception:
        # Log identifiers only — never request/letter text (PHI rule).
        logger.exception("pipeline failed for scenario_id=%s", request.scenario_id)
        yield ErrorEvent(
            message="Appeal generation failed due to an internal error.",
            retry_count=0,
        )


async def _run_pipeline_inner(
    request: AppealRequest,
    llm_backend,
) -> AsyncIterator[AppealEvent]:
    """Pipeline body: security gate → ingestion → retrieval → synthesis/gatekeeper loop."""
    # --- security hold enforcement (before any node runs) ---
    # The ETL sets security_hold when a source document is flagged (injection
    # phrases, bidi chars, hidden PDF text). A held request must never reach
    # the LLM — this is the single downstream enforcement point for that flag.
    if request.security_hold:
        reason = request.security_reason or "suspicious content detected in source document"
        yield ErrorEvent(
            message=f"Request blocked by security hold: {reason}",
            retry_count=0,
        )
        return

    # --- ingestion ---
    yield StepEvent(step="ingestion", label="Validating request…")
    state = run_ingestion(request)

    # --- retrieval ---
    yield StepEvent(step="retrieval", label="Retrieving PA requirements…")
    state = run_retrieval(state)

    # --- synthesis + gatekeeper loop ---
    for attempt in range(MAX_RETRIES):
        yield StepEvent(step="synthesis", label="Generating appeal letter…")

        # Stream tokens while also collecting the full text
        prompt = build_prompt(state)
        collected: list[str] = []
        async for chunk in llm_backend.generate_stream(prompt):
            collected.append(chunk)
            yield ChunkEvent(text=chunk)

        full_text = "".join(collected)
        state = apply_synthesis(state, full_text, llm_backend.model_name)

        # --- gatekeeper ---
        state = run_gatekeeper(state)

        if state["passed_gatekeeper"]:
            # Structural evaluation scores (deterministic, no LLM)
            try:
                scores = eval_structural(full_text, request)  # type: ignore[arg-type]
            except Exception as e:
                logger.warning("eval_structural failed: %s", e)
                scores = {}

            ref = hashlib.sha256(full_text.encode()).hexdigest()[:12]
            yield DoneEvent(
                model=state["model_name"],
                ref=ref,
                structural_scores=scores,
                pa_resolution=state.get("pa_resolution", ""),
            )
            return

        # Gatekeeper failed — prepare for retry
        state = {**state, "retry_count": attempt + 1}

    # All retries exhausted
    yield ErrorEvent(
        message=(
            "Appeal generation failed after "
            f"{MAX_RETRIES} attempts. "
            + (state["errors"][-1] if state.get("errors") else "Quality checks did not pass.")
        ),
        retry_count=MAX_RETRIES,
    )
