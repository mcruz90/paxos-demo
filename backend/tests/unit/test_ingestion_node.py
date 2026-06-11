"""Unit tests for agents/nodes/ingestion.py — validates/rejects malformed ScenarioConfig."""

import pytest
from pydantic import ValidationError

from agents.nodes.ingestion import run_ingestion
from models.schemas import AppealRequest, PipelineState


def test_valid_request_produces_pipeline_state(base_appeal_request: AppealRequest) -> None:
    """A well-formed AppealRequest should produce a PipelineState with populated fields."""
    state = run_ingestion(base_appeal_request)
    assert state["request"] == base_appeal_request
    assert state["pa_context"] == ""
    assert state["appeal_text"] == ""
    assert state["passed_gatekeeper"] is False
    assert state["retry_count"] == 0
    assert state["errors"] == []


def test_missing_required_field_raises() -> None:
    """AppealRequest with a missing required field should raise ValidationError before ingestion."""
    with pytest.raises(ValidationError):
        AppealRequest(
            # scenario_id omitted
            drug="Ozempic",
            diagnosis="Type 2 Diabetes",
            denial_text="Denied.",
            denial_reason="formulary",
            plan="BCBS PPO",
            plan_id="BCBS-001",
            criteria_results=[],
        )


def test_oversized_denial_text_raises() -> None:
    """denial_text exceeding 5000 chars should raise ValidationError."""
    with pytest.raises(ValidationError):
        AppealRequest(
            scenario_id="test-case",
            drug="Ozempic",
            diagnosis="Type 2 Diabetes",
            denial_text="x" * 5001,
            denial_reason="formulary",
            plan="BCBS PPO",
            plan_id="BCBS-001",
            criteria_results=[],
        )


def test_invalid_scenario_id_pattern_raises() -> None:
    """scenario_id must match ^[a-z0-9\\-]+$ — uppercase/special chars should raise."""
    with pytest.raises(ValidationError):
        AppealRequest(
            scenario_id="INVALID_ID!",
            drug="Ozempic",
            diagnosis="Type 2 Diabetes",
            denial_text="Denied.",
            denial_reason="formulary",
            plan="BCBS PPO",
            plan_id="BCBS-001",
            criteria_results=[],
        )
