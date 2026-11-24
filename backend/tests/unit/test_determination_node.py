"""Unit tests — agents/nodes/determination.py (S2 Slice 3).

Stub payer determination — deterministic, evidence-based:
  - non-empty criteria evidence, all `found`      → approved
  - empty evidence or any `needs_review`          → pended (info request);
    remains pending until the evidence changes
  - any `conflict`                                → denied → AppealHandoff

The handoff is a pointer (scenario + case_ref); launching the appeal stays a
separate human-gated request.
"""

from __future__ import annotations

from agents.nodes.crd_check import run_crd_check
from agents.nodes.determination import (
    derive_determination,
    make_appeal_handoff,
    run_determination,
)
from agents.nodes.pa_assembly import run_pa_assembly
from agents.nodes.pa_ingestion import run_pa_ingestion
from models.schemas import (
    CriterionResult,
    CriterionStatus,
    InitialPaRequest,
    PaDecision,
    Rule,
    RuleType,
)


def _criterion(status: CriterionStatus) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
        status=status,
        note="E11.9 documented",
    )


def _request(criteria: list[CriterionResult]) -> InitialPaRequest:
    return InitialPaRequest(
        scenario_id="novo-ozempic-initial",
        case_ref="PA-2026-0847",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        requested_therapy="Ozempic 0.5 mg subcutaneous weekly",
        criteria_results=criteria,
    )


# ---------------------------------------------------------------------------
# derive_determination — the pure decision rule
# ---------------------------------------------------------------------------


def test_all_found_evidence_is_approved() -> None:
    outcome = derive_determination(
        [_criterion(CriterionStatus.found)], pend_cycles=0, submission_ref="PAS-abc123"
    )
    assert outcome.decision is PaDecision.approved
    assert outcome.determination_id


def test_needs_review_evidence_is_pended_first_pass() -> None:
    outcome = derive_determination(
        [_criterion(CriterionStatus.needs_review)], pend_cycles=0, submission_ref="PAS-abc123"
    )
    assert outcome.decision is PaDecision.pended


def test_empty_evidence_is_pended_first_pass() -> None:
    outcome = derive_determination([], pend_cycles=0, submission_ref="PAS-abc123")
    assert outcome.decision is PaDecision.pended


def test_completed_cycle_alone_leaves_unresolved_evidence_pended() -> None:
    for evidence in ([], [_criterion(CriterionStatus.needs_review)]):
        outcome = derive_determination(evidence, pend_cycles=1, submission_ref="PAS-abc123")
        assert outcome.decision is PaDecision.pended


def test_conflict_evidence_is_denied_even_after_pend() -> None:
    outcome = derive_determination(
        [_criterion(CriterionStatus.conflict)],
        pend_cycles=1,
        submission_ref="PAS-abc123",
    )
    assert outcome.decision is PaDecision.denied


# ---------------------------------------------------------------------------
# make_appeal_handoff — denied → pointer into the appeal lifecycle
# ---------------------------------------------------------------------------


def test_appeal_handoff_carries_case_ref() -> None:
    handoff = make_appeal_handoff("novo-ozempic-initial", "PA-2026-0847")
    assert handoff.case_ref == "PA-2026-0847"
    assert handoff.scenario_id == "novo-ozempic-initial"


def test_appeal_handoff_falls_back_to_scenario_id_when_case_ref_empty() -> None:
    handoff = make_appeal_handoff("novo-ozempic-initial", "")
    assert handoff.case_ref == "novo-ozempic-initial"


# ---------------------------------------------------------------------------
# run_determination — node over InitialPaState
# ---------------------------------------------------------------------------


def _submitted_state(criteria: list[CriterionResult]):
    state = run_pa_assembly(run_crd_check(run_pa_ingestion(_request(criteria))))
    return {**state, "submission_ref": "PAS-abc123"}


def test_run_determination_approved_sets_outcome_no_handoff() -> None:
    updated = run_determination(_submitted_state([_criterion(CriterionStatus.found)]))
    assert updated["outcome"] is not None
    assert updated["outcome"].decision is PaDecision.approved
    assert updated["appeal_handoff"] is None


def test_run_determination_denied_sets_handoff() -> None:
    updated = run_determination(_submitted_state([_criterion(CriterionStatus.conflict)]))
    assert updated["outcome"] is not None
    assert updated["outcome"].decision is PaDecision.denied
    assert updated["appeal_handoff"] is not None
    assert updated["appeal_handoff"].case_ref == "PA-2026-0847"


def test_replaying_unresolved_determination_preserves_state() -> None:
    for evidence in ([], [_criterion(CriterionStatus.needs_review)]):
        state = _submitted_state(evidence)
        first = run_determination(state)
        assert first["outcome"] is not None
        assert first["outcome"].decision is PaDecision.pended
        second = run_determination(first)
        assert second["outcome"] is not None
        assert second["outcome"].decision is PaDecision.pended
        assert second == first
        assert first["pend_cycles"] == state["pend_cycles"]


def test_run_determination_state_purity() -> None:
    state = _submitted_state([_criterion(CriterionStatus.found)])
    _ = run_determination(state)
    assert state["outcome"] is None
