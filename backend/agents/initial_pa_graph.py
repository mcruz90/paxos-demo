"""agents/initial_pa_graph.py — LangGraph StateGraph for the initial-PA lifecycle.

Runs the initial-PA flow per docs/architecture/05-state-lifecycle.md:
    pa_ingestion → crd_check → [PA required?] → pa_assembly → pas_submit
                        └─ no ──→ finalize      → determination ⟲ (pended,
                                  (early exit)     bounded) → finalize

Denied determinations carry an AppealHandoff pointer on the done event; the
appeal is never auto-launched (human-gated). No LLM runs in this path.

Emits InitialPaEvent objects (StepEvent | InitialPaDoneEvent | ErrorEvent)
through LangGraph's custom stream channel, with the same boundary contract
as the appeal pipeline: security-hold gate before any node, and every stream
terminates with ``done`` or ``error``.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import cast

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from agents.nodes.crd_check import run_crd_check
from agents.nodes.determination import run_determination
from agents.nodes.pa_assembly import run_pa_assembly
from agents.nodes.pa_ingestion import run_pa_ingestion
from agents.nodes.pas_submit import run_pas_submit
from models.schemas import (
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaEvent,
    InitialPaRequest,
    InitialPaState,
    PaDecision,
    StepEvent,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Graph nodes — thin wrappers around the pure node functions in agents/nodes/.
# Wrappers own event emission (via the custom stream writer) and nothing else;
# node functions are resolved as module globals at call time so tests can
# monkeypatch them on this module.
# ---------------------------------------------------------------------------


async def _ingestion_node(state: InitialPaState) -> InitialPaState:
    return run_pa_ingestion(state["request"])


async def _crd_check_node(state: InitialPaState) -> InitialPaState:
    writer = get_stream_writer()
    writer(StepEvent(step="crd_check", label="Checking coverage requirements…"))
    return run_crd_check(state)


async def _assemble_node(state: InitialPaState) -> InitialPaState:
    writer = get_stream_writer()
    writer(StepEvent(step="assemble", label="Assembling structured PA request…"))
    return run_pa_assembly(state)


async def _pas_submit_node(state: InitialPaState) -> InitialPaState:
    writer = get_stream_writer()
    writer(StepEvent(step="pas_submit", label="Transmitting on the PAS rail…"))
    return run_pas_submit(state)


async def _determination_node(state: InitialPaState) -> InitialPaState:
    writer = get_stream_writer()
    writer(StepEvent(step="determination", label="Awaiting payer determination…"))
    return run_determination(state)


async def _finalize_node(state: InitialPaState) -> InitialPaState:
    writer = get_stream_writer()
    pa_required = state["pa_required"]
    assert pa_required is not None  # crd_check always runs before finalize
    writer(
        InitialPaDoneEvent(
            pa_required=pa_required,
            outcome=state["outcome"],
            appeal_handoff=state["appeal_handoff"],
            submission_ref=state["submission_ref"],
            pa_resolution=state["pa_resolution"],
        )
    )
    return state


def _after_crd_check(state: InitialPaState) -> str:
    """Conditional edge: PA required → assemble; not required → early exit."""
    pa_required = state["pa_required"]
    if pa_required is not None and pa_required.required:
        return "assemble"
    return "finalize"


def _after_determination(state: InitialPaState) -> str:
    """Conditional edge: pended → re-enter determination (bounded by the
    node's pend-cycle rule); approved/denied → finalize."""
    outcome = state["outcome"]
    if outcome is not None and outcome.decision is PaDecision.pended:
        return "determination"
    return "finalize"


def _build_graph() -> StateGraph:
    graph: StateGraph = StateGraph(InitialPaState)
    graph.add_node("ingestion", _ingestion_node)
    graph.add_node("crd_check", _crd_check_node)
    graph.add_node("assemble", _assemble_node)
    graph.add_node("pas_submit", _pas_submit_node)
    graph.add_node("determination", _determination_node)
    graph.add_node("finalize", _finalize_node)

    graph.add_edge(START, "ingestion")
    graph.add_edge("ingestion", "crd_check")
    graph.add_conditional_edges(
        "crd_check",
        _after_crd_check,
        {"assemble": "assemble", "finalize": "finalize"},
    )
    graph.add_edge("assemble", "pas_submit")
    graph.add_edge("pas_submit", "determination")
    graph.add_conditional_edges(
        "determination",
        _after_determination,
        # A pend re-enters determination only — it never re-submits the PA.
        {"determination": "determination", "finalize": "finalize"},
    )
    graph.add_edge("finalize", END)
    return graph


# Compiled once at import; stateless across runs (no checkpointer), so each
# invocation gets its own isolated InitialPaState (ACID §Isolation).
_PIPELINE = _build_graph().compile()


async def run_initial_pa_pipeline(
    request: InitialPaRequest,
) -> AsyncIterator[InitialPaEvent]:
    """Execute the initial-PA pipeline and yield SSE events.

    Boundary contract (same as the appeal pipeline): every stream terminates
    with a ``done`` or ``error`` event — a node exception must never
    propagate out of this generator, because SSE headers are already sent and
    the client would see a bare disconnect with no event.

    Args:
        request: A fully-validated :class:`InitialPaRequest`. No LLM backend
            parameter — this path never invokes a model.

    Yields:
        :class:`StepEvent`, :class:`InitialPaDoneEvent`, or
        :class:`ErrorEvent` objects.
    """
    try:
        # --- security hold enforcement (before any node runs) ---
        # Same single enforcement point as the appeal pipeline: a document
        # flagged by the ETL must never proceed, in either lifecycle.
        if request.security_hold:
            reason = request.security_reason or "suspicious content detected in source document"
            yield ErrorEvent(
                message=f"Request blocked by security hold: {reason}",
                retry_count=0,
            )
            return

        async for event in _PIPELINE.astream({"request": request}, stream_mode="custom"):
            # stream_mode="custom" yields exactly what the node wrappers wrote,
            # which is always an InitialPaEvent; the astream stub types it loosely.
            yield cast(InitialPaEvent, event)
    except Exception:
        # Log identifiers only — never request/document text (PHI rule).
        logger.exception("initial-PA pipeline failed for scenario_id=%s", request.scenario_id)
        yield ErrorEvent(
            message="Initial PA processing failed due to an internal error.",
            retry_count=0,
        )
