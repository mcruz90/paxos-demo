"""Integration tests — exception-tier checkpoint + interrupt (S3 Slice 4a).

The compliance-critical HITL primitive: an exception-tier run parks at a
durable LangGraph checkpoint (via ``interrupt()``) so a human can resume it,
instead of running to completion and being forgotten. This is why LangGraph
was chosen (ADR-0001) — the pause/resume is the framework's, not hand-rolled.

Contract preserved: ``finalize`` emits the exception ``DoneEvent`` BEFORE the
pause, so the SSE stream still terminates with ``done`` (CLAUDE.md §Defensive
Programming). The run then parks at the ``hold`` node; the checkpoint is keyed
by ``thread_id = correlation_id`` (the resume handle). Routine/complex runs
never park — no behavior change for them.

Run from backend/:
    uv run pytest tests/integration/test_exception_interrupt.py -v
"""

from __future__ import annotations

import pytest
from langchain_core.runnables import RunnableConfig
from langgraph.types import Command

from agents.graph import _PIPELINE, run_pipeline
from models.schemas import (
    AppealRequest,
    CaseTier,
    CriterionResult,
    CriterionStatus,
    DoneEvent,
    Rule,
    RuleType,
)
from tests.conftest import MockLLMBackend


def _criterion(confidence: float | None) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus confirmed"),
        status=CriterionStatus.found if confidence and confidence >= 0.70 else CriterionStatus.needs_review,
        note="",
        confidence=confidence,
    )


def _exception_request(scenario_id: str) -> AppealRequest:
    """An Ozempic/Cigna request the mock can draft a passing letter for, but
    whose criteria include a sub-0.70 confidence → the TierRouter routes it to
    the exception tier. Unique scenario_id ⇒ unique correlation_id ⇒ unique
    checkpoint thread, so tests don't collide in the shared InMemorySaver."""
    return AppealRequest(
        scenario_id=scenario_id,
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text="Denied.",
        denial_reason="step therapy",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        criteria_results=[_criterion(0.98), _criterion(0.50)],
    )


def _thread_config(correlation_id: str) -> RunnableConfig:
    return {"configurable": {"thread_id": correlation_id}}


@pytest.mark.asyncio
async def test_exception_run_terminates_with_done_then_parks_at_checkpoint() -> None:
    """The exception DoneEvent is emitted (stream terminates with `done`), and
    the run is then parked at a live interrupt checkpoint keyed by its
    correlation_id."""
    req = _exception_request("exc-parks-at-checkpoint")
    events = [e async for e in run_pipeline(req, llm_backend=MockLLMBackend())]

    # done|error contract holds: the terminal is a DoneEvent, tier = exception.
    assert [e.event for e in events].count("error") == 0
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert done.tier == CaseTier.exception
    assert done.correlation_id

    # The run parked at a durable checkpoint (LangGraph interrupt), keyed by
    # thread_id = correlation_id.
    snapshot = _PIPELINE.get_state(_thread_config(done.correlation_id))
    assert snapshot.next, "exception run must be parked, not completed"
    assert snapshot.interrupts, "a pending interrupt must be recorded"


@pytest.mark.asyncio
async def test_parked_exception_run_resumes_to_completion() -> None:
    """A parked run resumes via Command(resume=...) and reaches a clean end —
    proving the checkpoint is durable and the framework drives the resume."""
    req = _exception_request("exc-resumes-to-completion")
    events = [e async for e in run_pipeline(req, llm_backend=MockLLMBackend())]
    done = next(e for e in events if isinstance(e, DoneEvent))
    cfg = _thread_config(done.correlation_id)

    assert _PIPELINE.get_state(cfg).next  # parked before resume

    async for _ in _PIPELINE.astream(
        Command(resume={"reviewed": True}), config=cfg, stream_mode="custom"
    ):
        pass

    assert _PIPELINE.get_state(cfg).next == (), "resumed run must reach a clean end"


@pytest.mark.asyncio
async def test_complex_run_does_not_park(base_appeal_request: AppealRequest) -> None:
    """Routine/complex runs run straight to END — the interrupt is
    exception-only, so no non-exception run is ever left parked."""
    events = [e async for e in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend())]
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert done.tier == CaseTier.complex

    snapshot = _PIPELINE.get_state(_thread_config(done.correlation_id))
    assert snapshot.next == (), "a non-exception run must not park"
