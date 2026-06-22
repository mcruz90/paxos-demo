"""Unit tests for agents/nodes/gatekeeper.py — deterministic pass/fail matrix."""


from agents.nodes.gatekeeper import run_gatekeeper
from models.schemas import PipelineState
from tests.conftest import MOCK_APPEAL_TEXT


def _state_with_text(base_appeal_request, appeal_text: str) -> PipelineState:
    return {
        "request": base_appeal_request,
        "pa_context": "",
        "appeal_text": appeal_text,
        "model_name": "mock",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }


# --- Pass cases ---


def test_valid_letter_passes(base_appeal_request) -> None:
    state = _state_with_text(base_appeal_request, MOCK_APPEAL_TEXT)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is True
    assert updated["errors"] == []


def test_drug_name_as_substring_passes(base_appeal_request) -> None:
    """Drug name embedded mid-sentence should still count as present."""
    text = (
        "We appeal the denial for treatment with Ozempic (semaglutide) "
        "for Type 2 Diabetes Mellitus denial: formulary alternatives available. "
        + "A" * 300
    )
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is True


# --- Fail cases ---


def test_missing_drug_name_fails(base_appeal_request) -> None:
    text = (
        "We appeal this decision for treatment of Type 2 Diabetes Mellitus. "
        "The denial cited formulary alternatives available. " + "A" * 300
    )
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False
    assert updated["errors"] != []


def test_missing_diagnosis_fails(base_appeal_request) -> None:
    text = (
        "We appeal the denial for Ozempic. "
        "The denial cited formulary alternatives available. " + "A" * 300
    )
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False


def test_length_below_300_fails(base_appeal_request) -> None:
    text = "Ozempic Type 2 Diabetes Mellitus formulary alternatives available."
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False


def test_empty_string_fails(base_appeal_request) -> None:
    state = _state_with_text(base_appeal_request, "")
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False


def test_refusal_phrase_fails(base_appeal_request) -> None:
    text = (
        "I cannot assist with writing medical appeals. "
        "Ozempic Type 2 Diabetes Mellitus formulary alternatives available. "
        + "A" * 300
    )
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False


def test_ai_model_disclaimer_fails(base_appeal_request) -> None:
    text = (
        "As an AI language model, I can help draft this appeal for Ozempic "
        "for Type 2 Diabetes Mellitus, denial reason: formulary alternatives available. "
        + "A" * 300
    )
    state = _state_with_text(base_appeal_request, text)
    updated = run_gatekeeper(state)
    assert updated["passed_gatekeeper"] is False
