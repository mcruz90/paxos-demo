"""Unit tests for agents/nodes/synthesis.py — prompt assembly with MockLLMBackend."""

import pytest

from agents.nodes.synthesis import build_prompt, run_synthesis
from models.schemas import PipelineState


def test_build_prompt_wraps_denial_text_in_xml_delimiters(make_pipeline_state) -> None:
    """Untrusted denial_text must be enclosed in <denial_letter> XML tags."""
    state = make_pipeline_state()
    prompt = build_prompt(state)
    assert "<denial_letter>" in prompt
    assert "</denial_letter>" in prompt
    assert state["request"].denial_text in prompt


def test_build_prompt_wraps_pa_context_in_xml_delimiters(make_pipeline_state) -> None:
    """pa_context must be enclosed in <pa_requirements> XML tags."""
    state = make_pipeline_state()
    prompt = build_prompt(state)
    assert "<pa_requirements>" in prompt
    assert "</pa_requirements>" in prompt


def test_build_prompt_contains_drug_and_diagnosis(make_pipeline_state) -> None:
    """Prompt must include the drug name and diagnosis from the request."""
    state = make_pipeline_state()
    prompt = build_prompt(state)
    assert state["request"].drug in prompt
    assert state["request"].diagnosis in prompt


@pytest.mark.asyncio
async def test_run_synthesis_populates_appeal_text(make_pipeline_state, mock_llm) -> None:
    """run_synthesis with MockLLMBackend should set appeal_text to a non-empty string."""
    state = make_pipeline_state()
    updated = await run_synthesis(state, llm_backend=mock_llm)
    assert updated["appeal_text"] != ""
    assert isinstance(updated["appeal_text"], str)


@pytest.mark.asyncio
async def test_run_synthesis_records_model_name(make_pipeline_state, mock_llm) -> None:
    """model_name in state should be populated after synthesis."""
    state = make_pipeline_state()
    updated = await run_synthesis(state, llm_backend=mock_llm)
    assert updated["model_name"] == mock_llm.model_name
