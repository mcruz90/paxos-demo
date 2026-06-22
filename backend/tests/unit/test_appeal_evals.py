"""Unit tests for evals/appeal_evals.py — structural scoring (deterministic, no LLM)."""


from evals.appeal_evals import eval_structural
from tests.conftest import MOCK_APPEAL_TEXT


def test_all_scores_present(base_scenario) -> None:
    """eval_structural must return all expected score keys."""
    scores = eval_structural(MOCK_APPEAL_TEXT, base_scenario)
    expected_keys = {
        "drug_name_present",
        "diagnosis_present",
        "denial_addressed",
        "criteria_cited",
        "min_length",
    }
    assert expected_keys == set(scores.keys())


def test_passing_letter_scores_all_ones(base_scenario) -> None:
    """MOCK_APPEAL_TEXT should score 1.0 on all structural dimensions."""
    scores = eval_structural(MOCK_APPEAL_TEXT, base_scenario)
    for key, value in scores.items():
        assert value == 1.0, f"{key} expected 1.0, got {value}"


def test_missing_drug_name_scores_zero(base_scenario) -> None:
    text = (
        "We appeal the denial for treatment of Type 2 Diabetes Mellitus. "
        "Formulary alternatives available was cited as the denial reason. " + "A" * 300
    )
    scores = eval_structural(text, base_scenario)
    assert scores["drug_name_present"] == 0.0


def test_missing_diagnosis_scores_zero(base_scenario) -> None:
    text = (
        "We appeal the denial for Ozempic (semaglutide). "
        "Formulary alternatives available was the denial reason. " + "A" * 300
    )
    scores = eval_structural(text, base_scenario)
    assert scores["diagnosis_present"] == 0.0


def test_short_letter_scores_zero_on_min_length(base_scenario) -> None:
    scores = eval_structural("Too short.", base_scenario)
    assert scores["min_length"] == 0.0


def test_scores_are_floats_between_zero_and_one(base_scenario) -> None:
    scores = eval_structural(MOCK_APPEAL_TEXT, base_scenario)
    for key, value in scores.items():
        assert 0.0 <= value <= 1.0, f"{key}={value} out of [0, 1]"
