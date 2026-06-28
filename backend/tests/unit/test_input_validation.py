"""Unit tests for AppealRequest Pydantic validation — boundary inputs and malformed fields.

Also covers the Phase 0.A schema reconciliation: enum extensions, the clientType
constraint, and the optional lifecycle/appeal fields on ScenarioConfig that mirror
src/types.ts. All new ScenarioConfig fields are optional ⇒ adding them is backward
compatible (a minimal scenario must still validate).
"""

import pytest
from pydantic import ValidationError

from models.schemas import (
    AppealRequest,
    CaseLifecycle,
    CaseStatus,
    ClientType,
    CriterionResult,
    CriterionStatus,
    Rule,
    RuleType,
    ScenarioConfig,
    TimelineEvent,
)


def _valid_kwargs() -> dict:
    return {
        "scenario_id": "test-case-01",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": "Authorization denied. Formulary alternatives available.",
        "denial_reason": "formulary alternatives available",
        "plan": "BlueCross PPO",
        "plan_id": "BCBS-PPO-2024",
        "criteria_results": [],
    }


def test_valid_request_constructs_without_error() -> None:
    AppealRequest(**_valid_kwargs())


def test_scenario_id_uppercase_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["scenario_id"] = "TestCase"
    with pytest.raises(ValidationError, match="scenario_id"):
        AppealRequest(**kwargs)


def test_scenario_id_too_long_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["scenario_id"] = "a" * 65
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


def test_scenario_id_special_chars_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["scenario_id"] = "test_case!@#"
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


def test_drug_too_long_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["drug"] = "x" * 201
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


def test_denial_text_at_exact_max_accepted() -> None:
    kwargs = _valid_kwargs()
    kwargs["denial_text"] = "x" * 5000
    AppealRequest(**kwargs)


def test_denial_text_over_max_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["denial_text"] = "x" * 5001
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


def test_denial_reason_too_long_rejected() -> None:
    kwargs = _valid_kwargs()
    kwargs["denial_reason"] = "x" * 501
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


def test_strict_mode_rejects_int_for_string_field() -> None:
    """ConfigDict(strict=True) must reject numeric values for string fields."""
    kwargs = _valid_kwargs()
    kwargs["drug"] = 12345
    with pytest.raises(ValidationError):
        AppealRequest(**kwargs)


# ---------------------------------------------------------------------------
# Phase 0.A — enum reconciliation with src/types.ts
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("value", ["provider", "quantity", "custom"])
def test_ruletype_gains_frontend_members(value: str) -> None:
    """RuleType must cover all 7 frontend members, not just the original 4."""
    assert Rule.model_validate({"type": value, "label": "x"}).type == RuleType(value)


def test_criterion_status_gains_conflict() -> None:
    assert CriterionStatus("conflict") == CriterionStatus.conflict


def test_case_status_gains_payer_response() -> None:
    assert CaseStatus("payer_response") == CaseStatus.payer_response


# ---------------------------------------------------------------------------
# Phase 0.A — ScenarioConfig reconciliation
# ---------------------------------------------------------------------------


def _valid_scenario_kwargs() -> dict:
    """Minimal ScenarioConfig (camelCase aliases) with no optional lifecycle fields."""
    return {
        "id": "novo-ozempic",
        "configFile": "ozempic_cigna_base.json",
        "drug": "Ozempic (semaglutide)",
        "manufacturer": "Novo Nordisk",
        "plan": "Cigna Connect 500 PPO",
        "planId": "CIGNA-C500-2024",
        "categoryKey": "endocrinology",
        "categoryLabel": "Endocrinology",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denialReason": "step therapy not met",
        "clientType": "patient",
        "criteriaResults": [],
        "drugKey": "ozempic",
    }


def test_minimal_scenario_still_validates() -> None:
    """Adding optional fields must not break the minimal (appeal) scenario shape."""
    sc = ScenarioConfig(**_valid_scenario_kwargs())
    assert sc.lifecycle is None
    assert sc.timeline is None


def test_client_type_constrained_to_frontend_union() -> None:
    """clientType is the deliberate breaking fix: only 'medtech' | 'patient'."""
    assert ScenarioConfig(**(_valid_scenario_kwargs() | {"clientType": "medtech"})).client_type == (
        ClientType.medtech
    )
    with pytest.raises(ValidationError):
        ScenarioConfig(**(_valid_scenario_kwargs() | {"clientType": "commercial"}))


def test_criterion_result_conflict_sources_parses() -> None:
    cr = CriterionResult.model_validate(
        {
            "rule": {"type": "diagnostic", "label": "dx"},
            "status": "conflict",
            "note": "two sources disagree",
            "conflictSources": [
                {"source": "Chart p.2", "claim": "T2DM confirmed"},
                {"source": "Denial letter", "claim": "no T2DM on file"},
            ],
        }
    )
    assert cr.conflict_sources is not None
    assert cr.conflict_sources[0].claim == "T2DM confirmed"


def test_timeline_event_parses_and_rejects_bad_status() -> None:
    ev = TimelineEvent(label="PAS submitted", date="2026-06-10", status="done")
    assert ev.status == "done"
    with pytest.raises(ValidationError):
        TimelineEvent.model_validate({"label": "x", "date": "2026-06-10", "status": "nope"})


def test_full_initial_pa_scenario_parses_by_alias() -> None:
    """A full lifecycle scenario (camelCase, as the frontend emits) round-trips."""
    kwargs = _valid_scenario_kwargs() | {
        "lifecycle": "initial_pa",
        "paRequired": {"required": True, "basis": "Formulary step therapy"},
        "requestedTherapy": "Ozempic 0.5mg weekly",
        "paOutcome": {
            "decision": "denied",
            "determinationId": "DET-9001",
            "timeToTherapy": "3 days",
            "note": "Step therapy not satisfied",
        },
        "appealHandoff": {"scenarioId": "novo-ozempic", "caseRef": "PH-3102"},
        "timeline": [{"label": "PAS submitted", "date": "2026-06-10", "status": "done"}],
        "payerResponseAnalysis": {
            "responseType": "full_denial",
            "aiFlag": "Step therapy technicality",
            "aiRationale": "Metformin trial documented",
            "ctaAccept": "Accept",
            "ctaDispute": "Dispute",
        },
    }
    sc = ScenarioConfig(**kwargs)
    assert sc.lifecycle == CaseLifecycle.initial_pa
    assert sc.pa_outcome is not None and sc.pa_outcome.decision == "denied"
    assert sc.appeal_handoff is not None and sc.appeal_handoff.case_ref == "PH-3102"
    assert sc.timeline is not None and sc.timeline[0].status == "done"
