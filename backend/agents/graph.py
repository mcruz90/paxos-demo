"""agents/graph.py — LangGraph StateGraph pipeline orchestrator (ADR-0001).

Runs the 4-node DAG:
    ingestion → retrieval → synthesis → gatekeeper

as a ``StateGraph(PipelineState)``. The synthesis→gatekeeper cycle retries up
to MAX_RETRIES times via a conditional edge. SSE-compatible AppealEvent
objects are emitted through LangGraph's custom stream channel, so
``run_pipeline`` keeps its public signature and event contract from the
interim hand-rolled implementation.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import cast

from langchain_core.runnables import RunnableConfig
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from agents.nodes.gatekeeper import MAX_RETRIES, run_gatekeeper
from agents.nodes.ingestion import run_ingestion
from agents.nodes.retrieval import run_retrieval
from agents.nodes.synthesis import apply_synthesis, build_prompt
from audit.boundary import with_audit
from audit.ids import derive_case_id, derive_correlation_id, derive_idempotency_key
from evals.appeal_evals import eval_structural
from models.schemas import (
    AppealEvent,
    AppealRequest,
    AuditProvenance,
    AuditRecord,
    CaseLifecycle,
    ChunkEvent,
    DoneEvent,
    ErrorEvent,
    PipelineState,
    StepEvent,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Graph nodes — thin wrappers around the pure node functions in agents/nodes/.
# Wrappers own event emission (via the custom stream writer) and nothing else;
# all pipeline logic stays in the node modules. Node functions are resolved as
# module globals at call time, not captured at graph build time, so tests can
# monkeypatch them on this module.
# ---------------------------------------------------------------------------


async def _ingestion_node(state: PipelineState) -> PipelineState:
    writer = get_stream_writer()
    writer(StepEvent(step="ingestion", label="Validating request…"))
    return run_ingestion(state["request"])


async def _retrieval_node(state: PipelineState) -> PipelineState:
    writer = get_stream_writer()
    writer(StepEvent(step="retrieval", label="Retrieving PA requirements…"))
    return run_retrieval(state)


async def _synthesis_node(state: PipelineState, config: RunnableConfig) -> PipelineState:
    writer = get_stream_writer()
    writer(StepEvent(step="synthesis", label="Generating appeal letter…"))

    llm_backend = config["configurable"]["llm_backend"]

    # Stream tokens while also collecting the full text
    prompt = build_prompt(state)
    collected: list[str] = []
    async for chunk in llm_backend.generate_stream(prompt):
        collected.append(chunk)
        writer(ChunkEvent(text=chunk))

    return apply_synthesis(state, "".join(collected), llm_backend.model_name)


async def _gatekeeper_node(state: PipelineState) -> PipelineState:
    state = run_gatekeeper(state)
    if not state["passed_gatekeeper"]:
        state = {**state, "retry_count": state["retry_count"] + 1}
    return state


async def _finalize_node(state: PipelineState) -> PipelineState:
    writer = get_stream_writer()
    full_text = state["appeal_text"]

    # Structural evaluation scores (deterministic, no LLM)
    try:
        scores = eval_structural(full_text, state["request"])  # type: ignore[arg-type]
    except Exception as e:
        logger.warning("eval_structural failed: %s", e)
        scores = {}

    ref = hashlib.sha256(full_text.encode()).hexdigest()[:12]
    writer(
        DoneEvent(
            model=state["model_name"],
            ref=ref,
            structural_scores=scores,
            pa_resolution=state["pa_resolution"],
            retry_count=state["retry_count"],
        )
    )
    return state


async def _exhausted_node(state: PipelineState) -> PipelineState:
    writer = get_stream_writer()
    writer(
        ErrorEvent(
            message=(
                "Appeal generation failed after "
                f"{MAX_RETRIES} attempts. "
                + (state["errors"][-1] if state.get("errors") else "Quality checks did not pass.")
            ),
            retry_count=MAX_RETRIES,
        )
    )
    return state


def _after_gatekeeper(state: PipelineState) -> str:
    """Conditional edge: pass → finalize; fail → retry synthesis or give up."""
    if state["passed_gatekeeper"]:
        return "finalize"
    if state["retry_count"] < MAX_RETRIES:
        return "synthesis"
    return "exhausted"


def _build_graph() -> StateGraph:
    graph: StateGraph = StateGraph(PipelineState)
    graph.add_node("ingestion", _ingestion_node)
    graph.add_node("retrieval", _retrieval_node)
    graph.add_node("synthesis", _synthesis_node)
    graph.add_node("gatekeeper", _gatekeeper_node)
    graph.add_node("finalize", _finalize_node)
    graph.add_node("exhausted", _exhausted_node)

    graph.add_edge(START, "ingestion")
    graph.add_edge("ingestion", "retrieval")
    graph.add_edge("retrieval", "synthesis")
    graph.add_edge("synthesis", "gatekeeper")
    graph.add_conditional_edges(
        "gatekeeper",
        _after_gatekeeper,
        {"finalize": "finalize", "synthesis": "synthesis", "exhausted": "exhausted"},
    )
    graph.add_edge("finalize", END)
    graph.add_edge("exhausted", END)
    return graph


# Compiled once at import; stateless across runs (no checkpointer), so each
# invocation gets its own isolated PipelineState (ACID §Isolation).
_PIPELINE = _build_graph().compile()


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
            # No gatekeeper-correction or human-edit path exists yet — every
            # pipeline-boundary artifact is machine output as-is.
            provenance=AuditProvenance.as_is,
        )

    async for event in with_audit(
        _generate_events(request, llm_backend),
        correlation_id=correlation_id,
        build_record=build_record,
    ):
        yield event


async def _generate_events(
    request: AppealRequest,
    llm_backend,
) -> AsyncIterator[AppealEvent]:
    """Pipeline event stream: security gate → graph run → guaranteed terminal.

    A node exception must never propagate out of this generator, because SSE
    headers are already sent and the client would see a bare disconnect with
    no event. This is the one deliberate broad catch in the pipeline: it
    converts failures at the API boundary, it does not hide them (full detail
    is logged server-side; the client gets a generic message).
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

        config: RunnableConfig = {"configurable": {"llm_backend": llm_backend}}
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
