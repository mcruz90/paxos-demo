"""Unit tests for AppealRequest Pydantic validation — boundary inputs and malformed fields."""

import pytest
from pydantic import ValidationError

from models.schemas import AppealRequest


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
