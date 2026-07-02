"""Unit tests for agents/nodes/synthesis.py — prompt assembly + state update.

apply_synthesis is what the graph's streaming loop actually calls (the old
run_synthesis was dead code only its own tests exercised — hardening item 9).
"""

from agents.nodes.synthesis import apply_synthesis, build_prompt


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


def test_apply_synthesis_populates_appeal_text_and_model(make_pipeline_state) -> None:
    """apply_synthesis records the collected text + model name in new state."""
    state = make_pipeline_state()
    updated = apply_synthesis(state, "Dear Medical Director, ...", "mock-llm")
    assert updated["appeal_text"] == "Dear Medical Director, ..."
    assert updated["model_name"] == "mock-llm"


def test_apply_synthesis_does_not_mutate_input_state(make_pipeline_state) -> None:
    """Nodes are pure — the input state must be unchanged."""
    state = make_pipeline_state()
    apply_synthesis(state, "some letter text", "mock-llm")
    assert state["appeal_text"] == ""
    assert state["model_name"] == ""
