"""agents/graph.py — LangGraph StateGraph appeal orchestrator (ADR-0001).

Defines and compiles the appeal-generation DAG:
    ingestion → retrieval → synthesis⇄gatekeeper → tier_router → finalize
    → (hold → resume_finalize | END), with an exhausted error branch

as a ``StateGraph(PipelineState)``. The synthesis→gatekeeper cycle retries up
to MAX_RETRIES times via a conditional edge; an exception-tier run parks at
``hold`` via ``interrupt()`` behind an ``InMemorySaver`` checkpointer (S3
Slice 4a, ADR-0010). SSE-compatible AppealEvent objects are emitted through
LangGraph's custom stream channel, so ``run_pipeline`` keeps a stable public
signature and event contract.

This module owns the graph definition, the node wrappers, the shared
``_build_done_event`` helper, and the compiled ``_PIPELINE`` singleton. The two
entrypoints that drive that singleton are its clients, split out to keep this
module within the CLAUDE.md size limit:
[agents/generate.py](generate.py) (``run_pipeline`` — a fresh appeal run) and
[agents/resume.py](resume.py) (``run_resume`` — re-entering a parked run).
Neither ``_PIPELINE`` nor ``_build_done_event`` is duplicated in them.
"""

from __future__ import annotations

import hashlib
import logging

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from agents.nodes.gatekeeper import MAX_RETRIES, run_gatekeeper
from agents.nodes.ingestion import run_ingestion
from agents.nodes.retrieval import run_retrieval
from agents.nodes.synthesis import apply_synthesis, build_prompt
from agents.nodes.tier_router import run_tier_router
from evals.appeal_evals import eval_structural
from models.schemas import (
    CaseTier,
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


async def _tier_router_node(state: PipelineState) -> PipelineState:
    # Deterministic HITL routing on the gatekeeper-pass path (S3 Slice 3) —
    # never an LLM deciding tier (Illinois, MD HB 1563). Runs before finalize
    # so the DoneEvent can surface the review tier.
    writer = get_stream_writer()
    writer(StepEvent(step="tier_router", label="Assigning review tier…"))
    return run_tier_router(state)


def _build_done_event(state: PipelineState) -> DoneEvent:
    """Build the terminal DoneEvent from the current appeal text — shared by
    the primary finalize path and the resume path (S3 Slice 4b), so the
    outbound artifact is scored and hashed the same way whether it is the
    machine draft or a human-edited version."""
    full_text = state["appeal_text"]

    # Structural evaluation scores (deterministic, no LLM)
    try:
        scores = eval_structural(full_text, state["request"])  # type: ignore[arg-type]
    except Exception as e:
        logger.warning("eval_structural failed: %s", e)
        scores = {}

    ref = hashlib.sha256(full_text.encode()).hexdigest()[:12]
    return DoneEvent(
        model=state["model_name"],
        ref=ref,
        structural_scores=scores,
        pa_resolution=state["pa_resolution"],
        retry_count=state["retry_count"],
        tier=state["tier"],
    )


async def _finalize_node(state: PipelineState) -> PipelineState:
    writer = get_stream_writer()
    writer(_build_done_event(state))
    return state


async def _hold_node(state: PipelineState) -> PipelineState:
    """Park an exception-tier run at a durable checkpoint for human review
    (S3 Slice 4a) — the compliance-critical HITL primitive, LangGraph's own
    (ADR-0001), never hand-rolled.

    ``finalize`` has already emitted the exception ``DoneEvent``, so the SSE
    stream terminated with ``done`` (contract preserved) before this pause.
    ``interrupt()`` then suspends the run; the checkpoint is retained under
    ``thread_id = correlation_id`` so a human can resume it (S3 Slice 4b).
    Nothing side-effecting runs before ``interrupt()`` — on resume this node
    re-executes from the top, and ``interrupt()`` returns the human's input:
    ``{"edited_text": <str|None>}``. A non-empty ``edited_text`` replaces the
    drafted letter as the outbound artifact.
    """
    review = interrupt({"reason": "exception tier — human review required before submission"})
    edited = review.get("edited_text") if isinstance(review, dict) else None
    if edited:
        return {**state, "appeal_text": edited}
    return state


async def _resume_finalize_node(state: PipelineState) -> PipelineState:
    """Emit the terminal DoneEvent for a resumed run (S3 Slice 4b). Only
    reached on resume — the first pass parks at ``hold`` before it. Re-scores
    and re-hashes the (possibly human-edited) letter so the resume terminal
    and its audit record describe the actual outbound artifact."""
    writer = get_stream_writer()
    writer(_build_done_event(state))
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
    """Conditional edge: pass → tier_router; fail → retry synthesis or give up.

    On a pass the run first goes through tier_router (deterministic HITL
    routing) and only then to finalize. The exhausted branch produced no
    acceptable letter, so it never routes a tier — it terminates as an error.
    (tier_router only ever sees retry_count ≤ MAX_RETRIES-1: the exhausted
    branch intercepts >= MAX_RETRIES first, so decide_tier's
    gatekeeper-exhausted → exception rule is unreachable from this path and
    stays a defensive completeness guarantee, exercised in unit tests.)
    """
    if state["passed_gatekeeper"]:
        return "tier_router"
    if state["retry_count"] < MAX_RETRIES:
        return "synthesis"
    return "exhausted"


def _after_finalize(state: PipelineState) -> str:
    """Conditional edge: exception tier → hold (park for human review); every
    other tier → END. ``finalize`` already emitted the terminal DoneEvent
    either way, so parking the exception run does not break the SSE contract
    (S3 Slice 4a)."""
    return "hold" if state["tier"] == CaseTier.exception else END


def _build_graph() -> StateGraph:
    graph: StateGraph = StateGraph(PipelineState)
    graph.add_node("ingestion", _ingestion_node)
    graph.add_node("retrieval", _retrieval_node)
    graph.add_node("synthesis", _synthesis_node)
    graph.add_node("gatekeeper", _gatekeeper_node)
    graph.add_node("tier_router", _tier_router_node)
    graph.add_node("finalize", _finalize_node)
    graph.add_node("hold", _hold_node)
    graph.add_node("resume_finalize", _resume_finalize_node)
    graph.add_node("exhausted", _exhausted_node)

    graph.add_edge(START, "ingestion")
    graph.add_edge("ingestion", "retrieval")
    graph.add_edge("retrieval", "synthesis")
    graph.add_edge("synthesis", "gatekeeper")
    graph.add_conditional_edges(
        "gatekeeper",
        _after_gatekeeper,
        {"tier_router": "tier_router", "synthesis": "synthesis", "exhausted": "exhausted"},
    )
    graph.add_edge("tier_router", "finalize")
    graph.add_conditional_edges("finalize", _after_finalize, {"hold": "hold", END: END})
    # hold parks the run (interrupt); on resume it flows to resume_finalize,
    # which emits the terminal DoneEvent for the human-cleared letter (Slice 4b).
    graph.add_edge("hold", "resume_finalize")
    graph.add_edge("resume_finalize", END)
    graph.add_edge("exhausted", END)
    return graph


# Compiled once at import with an in-memory checkpointer (S3 Slice 4a,
# ADR-0010): required so an exception-tier run can park at an interrupt and be
# resumed. Isolation (ACID §Isolation) is preserved because checkpoints are
# *keyed* by thread_id = correlation_id (case_id:aN, unique per logical run) —
# runs never share mutable state; the store is keyed, not global-mutable.
# Known limits (both accepted pre-DB; a PostgreSQL checkpointer replaces this
# saver at Phase 3 alongside the durable audit store — ADR-0010):
#   1. The in-memory saver shards under multiple uvicorn workers, same as the
#      audit list.
#   2. langgraph 1.2.7 prints a deprecation notice when it deserializes our
#      schema types (RuleType/CaseTier/AppealRequest/…) from the checkpoint on
#      resume ("blocked in a future version"). Harmless today — resume works,
#      and it is a stderr notice, not a raised warning. It is *not* silenced by
#      the saver's serde config (the checkpoint load path does not honor a
#      per-instance allowlist here), so the fix belongs with the langgraph
#      upgrade / durable checkpointer, which registers the schema types.
_PIPELINE = _build_graph().compile(checkpointer=InMemorySaver())


def reset_checkpointer() -> None:
    """Test-only: clear the in-memory checkpoint store between tests.

    The compiled ``_PIPELINE`` (and its ``InMemorySaver``) is a process
    singleton, so parked checkpoints otherwise leak across tests — and the
    generate re-entry guard (which refuses to restart a parked thread; see
    [generate.py](generate.py)) then correctly fails a later test that reuses a
    parked correlation_id. Clears the saver's stores in place so every test
    starts from an empty checkpoint store, without rebinding the singleton that
    other modules imported by reference."""
    saver = _PIPELINE.checkpointer
    saver.storage.clear()
    saver.writes.clear()
    saver.blobs.clear()
