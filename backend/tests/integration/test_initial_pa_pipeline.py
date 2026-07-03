"""Integration tests — initial-PA LangGraph pipeline (S2 Slices 2–3).

Verifies the CRD → assemble flow, the "PA not required" early-exit
conditional edge, and the boundary guarantees (security-hold gate, terminal
done|error) carried over from the appeal pipeline. No LLM in this path —
run_initial_pa_pipeline takes no backend.
"""

from __future__ import annotations

import pytest

from agents.initial_pa_graph import run_initial_pa_pipeline
from models.schemas import (
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaRequest,
    StepEvent,
)


def _ozempic_request(**overrides) -> InitialPaRequest:
    kwargs = {
        "scenario_id": "novo-ozempic-initial",
        "case_ref": "PA-2026-0847",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic 0.5 mg subcutaneous weekly",
        "criteria_results": [],
    }
    kwargs.update(overrides)
    return InitialPaRequest(**kwargs)


def _no_pa_request() -> InitialPaRequest:
    return _ozempic_request(
        scenario_id="unknownia-initial",
        drug="Unknownia (xyzab)",
        diagnosis="Rare Syndrome X",
        plan="Some PPO",
        plan_id="SOME-PPO-2024",
        requested_therapy="Unknownia 10 mg daily",
    )


async def _collect(request: InitialPaRequest) -> list:
    return [event async for event in run_initial_pa_pipeline(request)]


@pytest.mark.asyncio
async def test_pa_required_path_runs_crd_then_assemble() -> None:
    events = await _collect(_ozempic_request())
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert "crd_check" in step_names
    assert "assemble" in step_names
    assert step_names.index("crd_check") < step_names.index("assemble")


@pytest.mark.asyncio
async def test_pa_required_path_terminates_with_done() -> None:
    events = await _collect(_ozempic_request())
    done = [e for e in events if isinstance(e, InitialPaDoneEvent)]
    assert len(done) == 1
    assert events[-1] is done[0]
    assert done[0].pa_required.required is True
    assert done[0].pa_resolution == "plan_id"


@pytest.mark.asyncio
async def test_pa_not_required_early_exit_skips_assemble() -> None:
    """Registry miss → CRD reports no requirement on file → the conditional
    edge exits before assembly (the 'PA not required' path in
    05-state-lifecycle.md)."""
    events = await _collect(_no_pa_request())
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert "crd_check" in step_names
    assert "assemble" not in step_names

    done = [e for e in events if isinstance(e, InitialPaDoneEvent)]
    assert len(done) == 1
    assert done[0].pa_required.required is False
    assert done[0].outcome is None


@pytest.mark.asyncio
async def test_security_hold_blocks_before_any_node() -> None:
    """The ETL detection flag's enforcement point carries over to the
    initial-PA lifecycle: a held request terminates with an ErrorEvent before
    any step runs (detection + enforcement pair, CLAUDE.md)."""
    held = _ozempic_request().model_copy(
        update={
            "security_hold": True,
            "security_reason": "injection pattern detected: ignore\\s+previous",
        }
    )
    events = [event async for event in run_initial_pa_pipeline(held)]

    assert [e.event for e in events] == ["error"]
    error = events[0]
    assert isinstance(error, ErrorEvent)
    assert "security hold" in error.message.lower()


@pytest.mark.asyncio
async def test_node_exception_terminates_stream_with_error_event(monkeypatch, caplog) -> None:
    """Same boundary contract as the appeal stream: a node exception surfaces
    as a terminal ErrorEvent with a generic message — never a bare disconnect,
    never leaked internals."""
    import agents.initial_pa_graph as graph_module

    def _boom(state):
        raise RuntimeError("simulated node failure: internal detail")

    monkeypatch.setattr(graph_module, "run_crd_check", _boom)

    events = []
    with caplog.at_level("ERROR"):
        async for event in run_initial_pa_pipeline(_ozempic_request()):
            events.append(event)

    assert events, "Stream must emit events, not die silently"
    assert events[-1].event == "error"
    assert "done" not in [e.event for e in events]
    error = next(e for e in events if isinstance(e, ErrorEvent))
    assert "internal detail" not in error.message
    assert any("pipeline" in r.message.lower() for r in caplog.records)


@pytest.mark.asyncio
async def test_every_stream_ends_with_done_or_error() -> None:
    for request in (_ozempic_request(), _no_pa_request()):
        events = await _collect(request)
        assert events[-1].event in {"done", "error"}
