"""Unit tests for agents/nodes/synthesis.py — prompt assembly with MockLLMBackend."""

import pytest

from agents.nodes.synthesis import build_prompt, run_synthesis
from models.schemas import PipelineState
from tests.conftest import MockLLMBackend


def _make_state(base_appeal_request, pa_context: str = "PA requirements: step therapy required.") -> PipelineState:
    return {
        "request": base_appeal_request,
        "pa_context": pa_context,
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }


def test_build_prompt_wraps_denial_text_in_xml_delimiters(base_appeal_request) -> None:
    """Untrusted denial_text must be enclosed in <denial_letter> XML tags."""
    state = _make_state(base_appeal_request)
    prompt = build_prompt(state)
    assert "<denial_letter>" in prompt
    assert "</denial_letter>" in prompt
    assert base_appeal_request.denial_text in prompt


def test_build_prompt_wraps_pa_context_in_xml_delimiters(base_appeal_request) -> None:
    """pa_context must be enclosed in <pa_requirements> XML tags."""
    state = _make_state(base_appeal_request)
    prompt = build_prompt(state)
    assert "<pa_requirements>" in prompt
    assert "</pa_requirements>" in prompt


def test_build_prompt_contains_drug_and_diagnosis(base_appeal_request) -> None:
    """Prompt must include the drug name and diagnosis from the request."""
    state = _make_state(base_appeal_request)
    prompt = build_prompt(state)
    assert base_appeal_request.drug in prompt
    assert base_appeal_request.diagnosis in prompt


@pytest.mark.asyncio
async def test_run_synthesis_populates_appeal_text(base_appeal_request) -> None:
    """run_synthesis with MockLLMBackend should set appeal_text to a non-empty string."""
    state = _make_state(base_appeal_request)
    backend = MockLLMBackend()
    updated = await run_synthesis(state, llm_backend=backend)
    assert updated["appeal_text"] != ""
    assert isinstance(updated["appeal_text"], str)


@pytest.mark.asyncio
async def test_run_synthesis_records_model_name(base_appeal_request) -> None:
    """model_name in state should be populated after synthesis."""
    state = _make_state(base_appeal_request)
    backend = MockLLMBackend()
    updated = await run_synthesis(state, llm_backend=backend)
    assert updated["model_name"] == MockLLMBackend.model_name
