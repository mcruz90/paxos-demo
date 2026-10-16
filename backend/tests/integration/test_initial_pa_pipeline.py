"""Integration tests — initial-PA LangGraph pipeline (S2 Slices 2–3).

Verifies the CRD → assemble flow, the "unknown — needs review" early-exit
conditional edge, and the boundary guarantees (security-hold gate, terminal
done|error) carried over from the appeal pipeline. No LLM in this path —
run_initial_pa_pipeline takes no backend.
"""

from __future__ import annotations

from typing import Any

import pytest

from agents.initial_pa_graph import run_initial_pa_pipeline
from models.schemas import (
    CriterionResult,
    CriterionStatus,
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaRequest,
    PaDecision,
    Rule,
    RuleType,
    StepEvent,
)


def _ozempic_request(**overrides: Any) -> InitialPaRequest:
    kwargs: dict[str, Any] = {
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
async def test_registry_miss_exits_unknown_for_review_skips_assemble() -> None:
    """Registry miss → CRD verdict unknown (required=None) → the conditional
    edge exits before assembly, nothing is submitted, and the done event
    carries the unknown verdict for a person — never "PA not required"
    (05-state-lifecycle.md)."""
    events = await _collect(_no_pa_request())
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert "crd_check" in step_names
    assert "assemble" not in step_names

    done = [e for e in events if isinstance(e, InitialPaDoneEvent)]
    assert len(done) == 1
    assert done[0].pa_required.required is None
    assert "needs review by a person" in done[0].pa_required.basis.lower()
    assert done[0].outcome is None
    assert done[0].submission_ref == ""


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


# ---------------------------------------------------------------------------
# Slice 3 — PAS rail + determination (approved / pended loop / denied→handoff)
# ---------------------------------------------------------------------------


def _criterion(status: CriterionStatus) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
        status=status,
        note="E11.9 documented",
    )


@pytest.mark.asyncio
async def test_approved_path_runs_full_rail_flow() -> None:
    """All-found evidence → crd_check → assemble → pas_submit → determination
    → done(approved), with a PAS submission_ref from the stub rail."""
    events = await _collect(
        _ozempic_request(criteria_results=[_criterion(CriterionStatus.found)])
    )
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert step_names == ["crd_check", "assemble", "pas_submit", "determination"]

    done = events[-1]
    assert isinstance(done, InitialPaDoneEvent)
    assert done.outcome is not None
    assert done.outcome.decision is PaDecision.approved
    assert done.submission_ref.startswith("PAS-")
    assert done.appeal_handoff is None


@pytest.mark.asyncio
async def test_pended_loop_re_runs_determination_then_resolves() -> None:
    """needs_review evidence → payer pends → the loop re-enters determination
    (bounded) and the stub resolves it — per the pended loop in
    05-state-lifecycle.md."""
    events = await _collect(
        _ozempic_request(criteria_results=[_criterion(CriterionStatus.needs_review)])
    )
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert step_names.count("determination") == 2, f"steps: {step_names}"
    assert step_names.count("pas_submit") == 1, "a pend must not re-submit the PA"

    done = events[-1]
    assert isinstance(done, InitialPaDoneEvent)
    assert done.outcome is not None
    assert done.outcome.decision is PaDecision.approved


# ---------------------------------------------------------------------------
# Slice 5 exit criteria — golden-set scenarios drive the initial-PA pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_golden_scenarios_run_through_initial_pa_pipeline() -> None:
    """Every non-redteam golden scenario, adapted to an InitialPaRequest,
    must flow the full CRD → assemble → PAS → determination path to a done
    terminal with a plan_id-resolved CRD hit (all golden plan_ids are in the
    requirements registry). Sprint 2 exit criteria."""
    from evals.fixtures.schema import load_scenarios_fixture
    from evals.fixtures_adapter import eval_scenario_to_initial_pa_request

    fixture = load_scenarios_fixture()
    ran = 0
    for scenario in fixture.scenarios:
        if scenario.denial_type == "redteam":
            continue
        request = eval_scenario_to_initial_pa_request(scenario)
        events = await _collect(request)

        assert events[-1].event == "done", (
            f"{scenario.scenario_id}: expected done terminal, got {[e.event for e in events]}"
        )
        done = events[-1]
        assert isinstance(done, InitialPaDoneEvent)
        assert done.pa_required.required is True
        assert done.pa_resolution == "plan_id"
        assert done.outcome is not None
        ran += 1

    assert ran >= 3, "expected at least the three golden anchors to run"


@pytest.mark.asyncio
async def test_denied_path_hands_off_to_appeal() -> None:
    """Conflicting evidence → denied → the done event carries the
    AppealHandoff pointer continuing the same case_ref. The appeal itself is
    NOT auto-launched — human-gated."""
    events = await _collect(
        _ozempic_request(criteria_results=[_criterion(CriterionStatus.conflict)])
    )
    done = events[-1]
    assert isinstance(done, InitialPaDoneEvent)
    assert done.outcome is not None
    assert done.outcome.decision is PaDecision.denied
    assert done.appeal_handoff is not None
    assert done.appeal_handoff.case_ref == "PA-2026-0847"


@pytest.mark.asyncio
async def test_drug_alias_only_match_exits_unknown_and_submits_nothing() -> None:
    """Known drug, unknown plan: another plan's pack must not drive a PA
    submission. CRD is unknown, nothing is assembled or submitted (ADR-0019)."""
    events = await _collect(
        _ozempic_request(plan="UnitedHealthcare Choice Plus", plan_id="UHC-UNKNOWN-2026")
    )
    step_names = [e.step for e in events if isinstance(e, StepEvent)]
    assert "assemble" not in step_names
    done = [e for e in events if isinstance(e, InitialPaDoneEvent)]
    assert len(done) == 1
    assert done[0].pa_required.required is None
    assert done[0].pa_resolution == "drug_alias"
    assert done[0].submission_ref == ""
