"""Tests for evals/fixtures_adapter.py — EvalScenario → pipeline-input bridge.

Validates:
- Every golden non-redteam scenario (clinical_pa + coding_error) adapts to a
  VALID AppealRequest and ScenarioConfig without raising.
- redteam scenarios raise FixturesAdapterError (they are adversarial inputs, not
  pipeline inputs).
- Unknown anchor_id raises FixturesAdapterError.
- Field-level mapping is correct for the three clinical_pa scenarios.

Run from backend/:
    uv run pytest tests/unit/test_fixtures_adapter.py -v
"""
from __future__ import annotations

import pytest

from evals.fixtures.schema import EvalScenario, load_scenarios_fixture
from evals.fixtures_adapter import (
    FixturesAdapterError,
    eval_scenario_to_appeal_request,
    eval_scenario_to_scenario_config,
)
from models.schemas import AppealRequest, CriterionStatus, ScenarioConfig

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(scenario_id: str) -> EvalScenario:
    fixture = load_scenarios_fixture()
    result = next((s for s in fixture.scenarios if s.scenario_id == scenario_id), None)
    assert result is not None, f"Scenario {scenario_id!r} not found"
    return result


_CLINICAL_PA_IDS = [
    "ozempic_cigna_clinical_pa",
    "esomeprazole_uhc_pediatric_clinical_pa",
    "livdelzi_cigna_hepatology_clinical_pa",
]

_REDTEAM_IDS = [
    "ozempic_cigna_injection_redteam",
    "esomeprazole_phi_leakage_redteam",
]


# ---------------------------------------------------------------------------
# ALL non-redteam scenarios produce valid AppealRequest + ScenarioConfig
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _CLINICAL_PA_IDS + ["ozempic_cigna_coding_error"])
def test_appeal_request_adapts_without_error(scenario_id: str) -> None:
    """Every non-redteam golden scenario must produce a valid AppealRequest."""
    scenario = _get(scenario_id)
    result = eval_scenario_to_appeal_request(scenario)
    assert isinstance(result, AppealRequest)


@pytest.mark.parametrize("scenario_id", _CLINICAL_PA_IDS + ["ozempic_cigna_coding_error"])
def test_scenario_config_adapts_without_error(scenario_id: str) -> None:
    """Every non-redteam golden scenario must produce a valid ScenarioConfig."""
    scenario = _get(scenario_id)
    result = eval_scenario_to_scenario_config(scenario)
    assert isinstance(result, ScenarioConfig)


# ---------------------------------------------------------------------------
# redteam scenarios raise FixturesAdapterError
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _REDTEAM_IDS)
def test_appeal_request_raises_for_redteam(scenario_id: str) -> None:
    """Redteam scenarios are adversarial inputs — must not adapt to pipeline inputs."""
    scenario = _get(scenario_id)
    with pytest.raises(FixturesAdapterError):
        eval_scenario_to_appeal_request(scenario)


@pytest.mark.parametrize("scenario_id", _REDTEAM_IDS)
def test_scenario_config_raises_for_redteam(scenario_id: str) -> None:
    scenario = _get(scenario_id)
    with pytest.raises(FixturesAdapterError):
        eval_scenario_to_scenario_config(scenario)


# ---------------------------------------------------------------------------
# Unknown anchor_id raises FixturesAdapterError
# ---------------------------------------------------------------------------


def test_raises_for_unknown_anchor_id() -> None:
    """An anchor_id not in the adapter's metadata map must raise FixturesAdapterError."""
    scenario = _get("ozempic_cigna_clinical_pa")
    bad = scenario.model_copy(update={"anchor_id": "unknown_payer_drug_xyz"})
    with pytest.raises(FixturesAdapterError, match="unknown_payer_drug_xyz"):
        eval_scenario_to_appeal_request(bad)


# ---------------------------------------------------------------------------
# Field-level mapping — ozempic_cigna clinical PA
# ---------------------------------------------------------------------------


def test_ozempic_appeal_request_drug_field() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    assert "ozempic" in req.drug.lower() or "semaglutide" in req.drug.lower()


def test_ozempic_appeal_request_plan_id_field() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    assert req.plan_id == scenario.plan_id


def test_ozempic_appeal_request_criteria_count() -> None:
    """clinical_pa criteria are mapped 1-to-1 into criteria_results."""
    scenario = _get("ozempic_cigna_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    assert len(req.criteria_results) == len(scenario.criteria)


def test_ozempic_appeal_request_criterion_status_preserved() -> None:
    """ground_truth_status values must round-trip through the adapter."""
    scenario = _get("ozempic_cigna_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    for adapted, golden in zip(req.criteria_results, scenario.criteria):
        assert adapted.status == CriterionStatus(golden.ground_truth_status)


def test_ozempic_scenario_config_drug_key() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    cfg = eval_scenario_to_scenario_config(scenario)
    assert cfg.drug_key == "ozempic"


def test_ozempic_scenario_config_config_file() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    cfg = eval_scenario_to_scenario_config(scenario)
    assert "ozempic_cigna" in cfg.config_file


def test_ozempic_scenario_config_plan_id() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    cfg = eval_scenario_to_scenario_config(scenario)
    assert cfg.plan_id == scenario.plan_id


# ---------------------------------------------------------------------------
# Field-level mapping — coding_error scenario (empty criteria)
# ---------------------------------------------------------------------------


def test_coding_error_appeal_request_has_empty_criteria() -> None:
    scenario = _get("ozempic_cigna_coding_error")
    req = eval_scenario_to_appeal_request(scenario)
    assert req.criteria_results == []


def test_coding_error_scenario_config_has_empty_criteria() -> None:
    scenario = _get("ozempic_cigna_coding_error")
    cfg = eval_scenario_to_scenario_config(scenario)
    assert cfg.criteria_results == []


# ---------------------------------------------------------------------------
# Field-level mapping — livdelzi (5 criteria, provider type)
# ---------------------------------------------------------------------------


def test_livdelzi_criteria_rule_types_preserved() -> None:
    """All 7 RuleType values that appear in golden criteria must survive the adapter."""
    from models.schemas import RuleType
    scenario = _get("livdelzi_cigna_hepatology_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    adapted_types = {cr.rule.type for cr in req.criteria_results}
    expected_types = {RuleType(c.rule_type) for c in scenario.criteria}
    assert adapted_types == expected_types


# ---------------------------------------------------------------------------
# Scenario id routing
# ---------------------------------------------------------------------------


def test_appeal_request_scenario_id_matches_eval_scenario_id() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    req = eval_scenario_to_appeal_request(scenario)
    # underscores normalized to hyphens: AppealRequest.scenario_id pattern is ^[a-z0-9\-]+$
    assert req.scenario_id == scenario.scenario_id.replace("_", "-")


def test_scenario_config_id_matches_eval_scenario_id() -> None:
    scenario = _get("ozempic_cigna_clinical_pa")
    cfg = eval_scenario_to_scenario_config(scenario)
    assert cfg.id == scenario.scenario_id


# ---------------------------------------------------------------------------
# S3 Slice 1 — confidence labels round-trip through the adapter
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _CLINICAL_PA_IDS)
def test_appeal_request_criterion_confidence_round_trips(scenario_id: str) -> None:
    """Golden confidence labels must survive the adapter — the TierRouter
    (S3 Slice 2) routes on them; a dropped label silently becomes 'not
    assessed' and mis-tiers the case."""
    scenario = _get(scenario_id)
    req = eval_scenario_to_appeal_request(scenario)
    for adapted, golden in zip(req.criteria_results, scenario.criteria):
        assert adapted.confidence == golden.confidence


@pytest.mark.parametrize("scenario_id", _CLINICAL_PA_IDS)
def test_initial_pa_request_criterion_confidence_round_trips(scenario_id: str) -> None:
    from evals.fixtures_adapter import eval_scenario_to_initial_pa_request

    scenario = _get(scenario_id)
    req = eval_scenario_to_initial_pa_request(scenario)
    for adapted, golden in zip(req.criteria_results, scenario.criteria):
        assert adapted.confidence == golden.confidence


# ---------------------------------------------------------------------------
# S2 Slice 5 — EvalScenario → InitialPaRequest (initial-PA lifecycle)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("scenario_id", _CLINICAL_PA_IDS + ["ozempic_cigna_coding_error"])
def test_initial_pa_request_adapts_without_error(scenario_id: str) -> None:
    """Every non-redteam golden scenario must produce a valid InitialPaRequest
    — the same case facts drive both lifecycles (one dataset, adapted per
    consumer)."""
    from evals.fixtures_adapter import eval_scenario_to_initial_pa_request
    from models.schemas import InitialPaRequest

    scenario = _get(scenario_id)
    result = eval_scenario_to_initial_pa_request(scenario)
    assert isinstance(result, InitialPaRequest)


def test_initial_pa_request_maps_case_facts() -> None:
    from evals.fixtures_adapter import eval_scenario_to_initial_pa_request

    scenario = _get("ozempic_cigna_clinical_pa")
    result = eval_scenario_to_initial_pa_request(scenario)

    assert result.scenario_id == "ozempic-cigna-clinical-pa"
    assert result.drug == scenario.drug
    assert result.plan_id == scenario.plan_id
    assert result.plan == scenario.payer
    # No dose detail exists in EvalScenario — the requested therapy is the
    # drug itself, never invented data.
    assert result.requested_therapy == scenario.drug
    assert result.case_ref == ""  # correlation falls back to scenario_id
    assert len(result.criteria_results) == len(scenario.criteria)


@pytest.mark.parametrize("scenario_id", _REDTEAM_IDS)
def test_initial_pa_request_guards_redteam(scenario_id: str) -> None:
    from evals.fixtures_adapter import eval_scenario_to_initial_pa_request

    scenario = _get(scenario_id)
    with pytest.raises(FixturesAdapterError):
        eval_scenario_to_initial_pa_request(scenario)
