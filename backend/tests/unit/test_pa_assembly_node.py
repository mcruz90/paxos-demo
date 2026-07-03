"""Unit tests — agents/nodes/pa_assembly.py + pa_ingestion.py (S2 Slice 2).

Assembly builds the canonical structured PA request (PaSubmission) from the
validated request plus the CRD-resolved criteria. Canonical shape only — the
PAS/X12-278 rail shape is the Slice 3 adapter's job (adapter pattern:
canonical in, rail shape out).
"""

from __future__ import annotations

from agents.nodes.crd_check import run_crd_check
from agents.nodes.pa_assembly import build_submission, run_pa_assembly
from agents.nodes.pa_ingestion import run_pa_ingestion
from models.schemas import (
    CriterionResult,
    CriterionStatus,
    InitialPaRequest,
    PaSubmission,
    Rule,
    RuleType,
)


def _request() -> InitialPaRequest:
    return InitialPaRequest(
        scenario_id="novo-ozempic-initial",
        case_ref="PA-2026-0847",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        requested_therapy="Ozempic 0.5 mg subcutaneous weekly",
        criteria_results=[
            CriterionResult(
                rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
                status=CriterionStatus.found,
                note="E11.9 documented",
            )
        ],
    )


# ---------------------------------------------------------------------------
# pa_ingestion — fresh zero-value state
# ---------------------------------------------------------------------------


def test_pa_ingestion_initializes_zero_state() -> None:
    state = run_pa_ingestion(_request())
    assert state["request"].scenario_id == "novo-ozempic-initial"
    assert state["pa_required"] is None
    assert state["pa_context"] == ""
    assert state["pa_resolution"] == ""
    assert state["submission"] is None
    assert state["outcome"] is None
    assert state["appeal_handoff"] is None
    assert state["submission_ref"] == ""
    assert state["errors"] == []


# ---------------------------------------------------------------------------
# build_submission — the pure assembly rule (typed values in, typed value out)
# ---------------------------------------------------------------------------


def test_build_submission_carries_request_facts() -> None:
    request = _request()
    submission = build_submission(request, "Cigna criteria: A1c ≥ 7.0 despite metformin.")
    assert isinstance(submission, PaSubmission)
    assert submission.case_ref == "PA-2026-0847"
    assert submission.scenario_id == "novo-ozempic-initial"
    assert submission.drug == "Ozempic (semaglutide)"
    assert submission.diagnosis == "Type 2 Diabetes Mellitus"
    assert submission.plan_id == "CIGNA-CNF360-2024"
    assert submission.requested_therapy == "Ozempic 0.5 mg subcutaneous weekly"
    assert submission.pa_context == "Cigna criteria: A1c ≥ 7.0 despite metformin."
    assert len(submission.criteria_evidence) == 1


# ---------------------------------------------------------------------------
# run_pa_assembly — node over InitialPaState
# ---------------------------------------------------------------------------


def test_pa_assembly_populates_submission() -> None:
    state = run_crd_check(run_pa_ingestion(_request()))
    updated = run_pa_assembly(state)
    assert updated["submission"] is not None
    assert updated["submission"].drug == "Ozempic (semaglutide)"
    assert updated["submission"].pa_context == state["pa_context"]


def test_pa_assembly_state_purity() -> None:
    state = run_crd_check(run_pa_ingestion(_request()))
    _ = run_pa_assembly(state)
    assert state["submission"] is None
