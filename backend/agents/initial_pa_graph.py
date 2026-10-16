"""agents/initial_pa_graph.py — LangGraph StateGraph for the initial-PA lifecycle.

Runs the initial-PA flow per docs/architecture/05-state-lifecycle.md:
    pa_ingestion → crd_check → [PA required?] → pa_assembly → pas_submit
                        └─ no / unknown ──→ finalize  → determination ⟲ (pended,
                                  (early exit;       bounded) → finalize
                                   unknown = a person decides)

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
from datetime import UTC, datetime
from typing import cast

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph

from agents.nodes.crd_check import run_crd_check
from agents.nodes.determination import run_determination
from agents.nodes.pa_assembly import run_pa_assembly
from agents.nodes.pa_ingestion import run_pa_ingestion
from agents.nodes.pas_submit import run_pas_submit
from audit.boundary import with_audit
from audit.ids import derive_case_id, derive_correlation_id, derive_idempotency_key
from models.schemas import (
    AuditProvenance,
    AuditRecord,
    CaseLifecycle,
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
    """Conditional edge: PA required → assemble; not required or unknown →
    early exit. Unknown (``required is None``) never submits: the done event
    carries the unknown verdict to a person (ADR-0018)."""
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
    with a ``done`` or ``error`` event, the terminal event carries the run's
    ``correlation_id``, and exactly one :class:`AuditRecord` is written
    before the terminal event is yielded (idempotent on case + attempt —
    ADR-0009).

    Args:
        request: A fully-validated :class:`InitialPaRequest`. No LLM backend
            parameter — this path never invokes a model.

    Yields:
        :class:`StepEvent`, :class:`InitialPaDoneEvent`, or
        :class:`ErrorEvent` objects.
    """
    case_id = derive_case_id(request.case_ref, request.scenario_id)
    correlation_id = derive_correlation_id(case_id, request.attempt)
    idempotency_key = derive_idempotency_key(case_id, request.attempt)

    def build_record(event: InitialPaEvent, duration_ms: int) -> AuditRecord:
        done = event if isinstance(event, InitialPaDoneEvent) else None
        return AuditRecord(
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
            # Tenancy seam (ADR-0017): owning tenant + patient token from the
            # request (seeded default pre-DB); a scoping column, not identity.
            tenant_id=request.tenant_id,
            patient_ref=request.patient_ref,
            lifecycle=CaseLifecycle.initial_pa,
            case_ref=request.case_ref,
            scenario_id=request.scenario_id,
            drug=request.drug,
            plan=request.plan,
            timestamp=datetime.now(UTC).isoformat(),
            duration_ms=duration_ms,
            outcome="done" if done else "error",
            # No LLM in this path — model_name stays "".
            artifact_ref=done.submission_ref if done else "",
            pa_resolution=done.pa_resolution if done else "",
            # Machine-assembled artifact, unedited.
            provenance=AuditProvenance.as_is,
        )

    async for event in with_audit(
        _generate_events(request),
        correlation_id=correlation_id,
        build_record=build_record,
    ):
        yield event


async def _generate_events(
    request: InitialPaRequest,
) -> AsyncIterator[InitialPaEvent]:
    """Pipeline event stream: security gate → graph run → guaranteed terminal.

    A node exception must never propagate out of this generator (SSE headers
    are already sent); the broad catch converts it to a terminal ``error``
    event with a generic message, full detail logged server-side.
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
