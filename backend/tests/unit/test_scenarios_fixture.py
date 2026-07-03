"""Tests for the canonical eval scenarios fixture (Phase 0.D).

Validates:
- scenarios.json is valid JSON that parses into typed Pydantic models
- All 4 required scenarios are present (3 clinical_pa + 1 coding_error)
- Per-scenario structural invariants hold for each denial_type
- coding_error scenarios have discrepancy_signals, not appeal criteria
- clinical_pa scenarios have ground-truth criteria and are appealable
- discrepancy_signal.policy_statement has a source_ref (faithfulness gate)

Run from backend/:
    uv run pytest tests/unit/test_scenarios_fixture.py -v
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from evals.fixtures.schema import ScenariosFixture, load_scenarios_fixture
from models.schemas import CriterionStatus

_FIXTURE_PATH = (
    Path(__file__).parent.parent.parent / "evals" / "fixtures" / "scenarios.json"
)

_REQUIRED_SCENARIO_IDS = {
    "ozempic_cigna_clinical_pa",
    "esomeprazole_uhc_pediatric_clinical_pa",
    "livdelzi_cigna_hepatology_clinical_pa",
    "ozempic_cigna_coding_error",
}

_CLINICAL_PA_IDS = {
    "ozempic_cigna_clinical_pa",
    "esomeprazole_uhc_pediatric_clinical_pa",
    "livdelzi_cigna_hepatology_clinical_pa",
}

_CODING_ERROR_IDS = {"ozempic_cigna_coding_error"}


# ── FILE & LOAD ───────────────────────────────────────────────────────────────


def test_fixture_file_exists() -> None:
    """scenarios.json must exist at evals/fixtures/scenarios.json."""
    assert _FIXTURE_PATH.exists(), f"Fixture not found at {_FIXTURE_PATH}"


def test_fixture_is_valid_json() -> None:
    """scenarios.json must be syntactically valid JSON."""
    raw = _FIXTURE_PATH.read_text(encoding="utf-8")
    json.loads(raw)  # raises if invalid


def test_fixture_has_schema_version() -> None:
    """Top-level 'schema_version' field must be present."""
    raw = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    assert "schema_version" in raw


def test_fixture_parses_into_typed_model() -> None:
    """load_scenarios_fixture() must return a ScenariosFixture without validation errors."""
    fixture = load_scenarios_fixture()
    assert isinstance(fixture, ScenariosFixture)
    assert len(fixture.scenarios) > 0


# ── REQUIRED SCENARIOS PRESENT ────────────────────────────────────────────────


def test_all_required_scenario_ids_present() -> None:
    """All 4 required scenario IDs must be present in the fixture."""
    fixture = load_scenarios_fixture()
    found_ids = {s.scenario_id for s in fixture.scenarios}
    missing = _REQUIRED_SCENARIO_IDS - found_ids
    assert not missing, f"Missing scenario IDs: {missing}"


# ── INVARIANTS FOR ALL SCENARIOS ──────────────────────────────────────────────


@pytest.mark.parametrize("scenario_id", sorted(_REQUIRED_SCENARIO_IDS))
def test_scenario_has_required_top_level_fields(scenario_id: str) -> None:
    """Every scenario must have the required top-level fields populated."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.anchor_id
    assert scenario.denial_type
    assert scenario.drug
    assert scenario.payer
    assert scenario.plan_id
    assert scenario.appeal_process_ref
    assert scenario.submitted_codes.icd10
    assert scenario.expected_outcome is not None


@pytest.mark.parametrize("scenario_id", sorted(_REQUIRED_SCENARIO_IDS))
def test_scenario_denial_type_is_valid(scenario_id: str) -> None:
    """denial_type must be one of the allowed literals."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.denial_type in {"clinical_pa", "coding_error", "administrative"}


# ── CLINICAL PA INVARIANTS ────────────────────────────────────────────────────


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_has_criteria(scenario_id: str) -> None:
    """clinical_pa scenarios must have at least one criterion."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.criteria, f"{scenario_id}: criteria list is empty"


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_criteria_ground_truth_status_is_valid(scenario_id: str) -> None:
    """Every criterion ground_truth_status must match CriterionStatus enum values."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    valid_statuses = {s.value for s in CriterionStatus}
    for crit in scenario.criteria:
        assert crit.ground_truth_status in valid_statuses, (
            f"{scenario_id} criterion {crit.key!r}: "
            f"invalid status {crit.ground_truth_status!r}"
        )


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_criteria_have_confidence_labels(scenario_id: str) -> None:
    """S3 Slice 1: every golden criterion carries a numeric 0–1 confidence label.

    Semantics: confidence that the finding is correct AND complete enough to
    act on without human input — the ground truth the TierRouter bands
    (S3 Slice 2) route against. A labeled criterion without confidence is an
    unlabeled criterion.
    """
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    for crit in scenario.criteria:
        assert crit.confidence is not None, (
            f"{scenario_id} criterion {crit.key!r}: missing confidence label"
        )
        assert 0.0 <= crit.confidence <= 1.0, (
            f"{scenario_id} criterion {crit.key!r}: "
            f"confidence {crit.confidence} outside [0, 1]"
        )


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_has_at_least_one_needs_review_or_conflict(scenario_id: str) -> None:
    """clinical_pa scenarios must have ≥1 criterion that is not 'found' — that is the denial basis."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    non_found = [c for c in scenario.criteria if c.ground_truth_status != CriterionStatus.found]
    assert non_found, (
        f"{scenario_id}: all criteria are 'found' — no denial basis present"
    )


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_is_appealable(scenario_id: str) -> None:
    """clinical_pa expected_outcome.appealable must be True."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.expected_outcome.appealable is True


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_resolution_path_is_appeal(scenario_id: str) -> None:
    """clinical_pa expected_outcome.resolution_path must be 'appeal'."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.expected_outcome.resolution_path == "appeal"


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_primary_argument_key_references_a_criterion(scenario_id: str) -> None:
    """primary_argument_key must match one of the criterion keys in the scenario."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    if scenario.expected_outcome.primary_argument_key is not None:
        criterion_keys = {c.key for c in scenario.criteria}
        assert scenario.expected_outcome.primary_argument_key in criterion_keys, (
            f"{scenario_id}: primary_argument_key "
            f"{scenario.expected_outcome.primary_argument_key!r} not in criteria keys"
        )


# ── CODING ERROR INVARIANTS ───────────────────────────────────────────────────


@pytest.mark.parametrize("scenario_id", sorted(_CODING_ERROR_IDS))
def test_coding_error_has_discrepancy_signals(scenario_id: str) -> None:
    """coding_error scenarios must have at least one discrepancy_signal."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.discrepancy_signals, (
        f"{scenario_id}: discrepancy_signals list is empty"
    )


@pytest.mark.parametrize("scenario_id", sorted(_CODING_ERROR_IDS))
def test_coding_error_signals_have_required_fields(scenario_id: str) -> None:
    """Every discrepancy_signal must have all required fields populated."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    for sig in scenario.discrepancy_signals:
        assert sig.signal_id
        assert sig.observation
        assert sig.policy_statement
        assert sig.source_ref
        assert sig.likelihood in {"high", "medium", "low"}
        assert sig.human_action_required is True
        assert sig.suggested_action_type


@pytest.mark.parametrize("scenario_id", sorted(_CODING_ERROR_IDS))
def test_coding_error_is_not_appealable(scenario_id: str) -> None:
    """coding_error expected_outcome.appealable must be False — resolution is resubmission."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.expected_outcome.appealable is False


@pytest.mark.parametrize("scenario_id", sorted(_CODING_ERROR_IDS))
def test_coding_error_resolution_path_is_corrected_claim(scenario_id: str) -> None:
    """coding_error resolution_path must be 'corrected_claim_resubmission'."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.expected_outcome.resolution_path == "corrected_claim_resubmission"


@pytest.mark.parametrize("scenario_id", sorted(_CODING_ERROR_IDS))
def test_coding_error_criteria_list_is_empty(scenario_id: str) -> None:
    """coding_error scenarios have no PA criteria to evaluate — only code signals."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.criteria == [], (
        f"{scenario_id}: coding_error scenario should have empty criteria list"
    )


# ── SIGNAL FAITHFULNESS GATE ──────────────────────────────────────────────────


def test_all_discrepancy_signals_have_source_ref() -> None:
    """Every discrepancy_signal across all scenarios must have a non-empty source_ref.

    source_ref gates faithfulness: policy_statement must be attributable to a
    specific document.  A signal without a source is an unattributed assertion.
    """
    fixture = load_scenarios_fixture()
    for scenario in fixture.scenarios:
        for sig in scenario.discrepancy_signals:
            assert sig.source_ref, (
                f"scenario={scenario.scenario_id!r} signal={sig.signal_id!r}: "
                "source_ref is empty"
            )


def test_all_discrepancy_signals_require_human_action() -> None:
    """human_action_required must be True on all signals — system never acts autonomously."""
    fixture = load_scenarios_fixture()
    for scenario in fixture.scenarios:
        for sig in scenario.discrepancy_signals:
            assert sig.human_action_required is True, (
                f"scenario={scenario.scenario_id!r} signal={sig.signal_id!r}: "
                "human_action_required must be True"
            )


# ── CANONICAL LOADER GUARD ────────────────────────────────────────────────────


def test_load_raises_validation_error_on_malformed_json(tmp_path: Path) -> None:
    """load_scenarios_fixture must raise pydantic.ValidationError — not a bare except — on bad JSON.

    This guards that the loader fails fast and typed, never swallows parse errors.
    """
    from pydantic import ValidationError

    bad = tmp_path / "bad.json"
    bad.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(ValidationError):
        load_scenarios_fixture(path=bad)


def test_load_raises_on_missing_file(tmp_path: Path) -> None:
    """load_scenarios_fixture must propagate FileNotFoundError when the path does not exist."""
    missing = tmp_path / "does_not_exist.json"
    with pytest.raises(FileNotFoundError):
        load_scenarios_fixture(path=missing)
