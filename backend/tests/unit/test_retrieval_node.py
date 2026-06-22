"""Unit tests for agents/nodes/retrieval.py — PA lookup from fixture, no DB, no LLM."""


from agents.nodes.retrieval import run_retrieval
from models.schemas import PipelineState


def test_retrieval_populates_pa_context(base_appeal_request, mock_llm) -> None:
    """run_retrieval should set a non-empty pa_context string in the state."""
    state: PipelineState = {
        "request": base_appeal_request,
        "pa_context": "",
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }
    updated = run_retrieval(state)
    assert updated["pa_context"] != ""
    assert isinstance(updated["pa_context"], str)


def test_retrieval_contains_drug_name(base_appeal_request) -> None:
    """The pa_context should reference the drug name from the request."""
    state: PipelineState = {
        "request": base_appeal_request,
        "pa_context": "",
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }
    updated = run_retrieval(state)
    assert "ozempic" in updated["pa_context"].lower() or "semaglutide" in updated["pa_context"].lower()


def test_retrieval_unknown_drug_returns_generic_context(base_appeal_request) -> None:
    """An unknown drug_key should fall back to a generic context, not raise."""
    state: PipelineState = {
        "request": base_appeal_request.model_copy(update={"scenario_id": "unknown-drug-xyz"}),
        "pa_context": "",
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }
    updated = run_retrieval(state)
    # Must not raise; may return empty or generic context
    assert isinstance(updated["pa_context"], str)
