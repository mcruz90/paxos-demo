"""Integration tests — full 4-node LangGraph DAG with MockLLMBackend.

No real LLM is called. Verifies the full pipeline produces the expected
SSE event sequence and that the gatekeeper accepts MOCK_APPEAL_TEXT.
"""

from __future__ import annotations

import pytest

from agents.graph import run_pipeline
from models.schemas import AppealRequest, DoneEvent, ErrorEvent, StepEvent
from tests.conftest import MockLLMBackend


@pytest.mark.asyncio
async def test_full_pipeline_emits_done_event(base_appeal_request: AppealRequest) -> None:
    """A valid request through the full DAG should emit a DoneEvent (not ErrorEvent)."""
    events = []
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        events.append(event)

    event_types = [e.event for e in events]
    assert "done" in event_types, f"Expected 'done' in {event_types}"
    assert "error" not in event_types, f"Unexpected 'error' in {event_types}"


@pytest.mark.asyncio
async def test_pipeline_step_sequence(base_appeal_request: AppealRequest) -> None:
    """Steps must appear in order: ingestion → retrieval → synthesis before done."""
    events = []
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        events.append(event)

    step_events = [e for e in events if isinstance(e, StepEvent)]
    step_names = [e.step for e in step_events]

    assert "ingestion" in step_names
    assert "retrieval" in step_names
    assert "synthesis" in step_names

    assert step_names.index("ingestion") < step_names.index("retrieval")
    assert step_names.index("retrieval") < step_names.index("synthesis")


@pytest.mark.asyncio
async def test_pipeline_emits_at_least_one_chunk(base_appeal_request: AppealRequest) -> None:
    """At least one ChunkEvent with non-empty text must be emitted during synthesis."""
    from models.schemas import ChunkEvent
    chunks = []
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        if isinstance(event, ChunkEvent):
            chunks.append(event)

    assert len(chunks) >= 1
    assert all(c.text for c in chunks)


@pytest.mark.asyncio
async def test_done_event_contains_model_name(base_appeal_request: AppealRequest) -> None:
    """DoneEvent must carry the model_name set by the synthesis node."""
    done = None
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        if isinstance(event, DoneEvent):
            done = event
    assert done is not None
    assert done.model == MockLLMBackend.model_name


@pytest.mark.asyncio
async def test_done_event_contains_structural_scores(base_appeal_request: AppealRequest) -> None:
    """DoneEvent.structural_scores must contain the expected eval dimensions."""
    done = None
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        if isinstance(event, DoneEvent):
            done = event
    assert done is not None
    expected_keys = {"drug_name_present", "diagnosis_present", "min_length"}
    assert expected_keys.issubset(done.structural_scores.keys())


@pytest.mark.asyncio
async def test_gatekeeper_retry_emits_error_after_max_retries(
    base_appeal_request: AppealRequest,
) -> None:
    """When MockLLMBackend always returns text that fails the gatekeeper, after 3 retries
    an ErrorEvent must be emitted."""

    class AlwaysFailBackend:
        model_name = "always-fail"

        async def generate_stream(self, prompt):
            yield "I cannot assist with this request."

        async def generate(self, prompt):
            return "I cannot assist with this request."

    events = []
    async for event in run_pipeline(base_appeal_request, llm_backend=AlwaysFailBackend()):
        events.append(event)

    event_types = [e.event for e in events]
    assert "error" in event_types
    assert "done" not in event_types

    error_event = next(e for e in events if isinstance(e, ErrorEvent))
    assert error_event.retry_count == 3


@pytest.mark.asyncio
async def test_eval_structural_failure_is_logged_not_silently_swallowed(
    base_appeal_request: AppealRequest, monkeypatch, caplog
) -> None:
    """A bug in eval_structural (e.g. AttributeError from a schema change) must be
    logged, not silently swallowed into an empty structural_scores dict that's
    indistinguishable from a genuine zero score (backend-security-debt item 5)."""
    import agents.graph as graph_module

    def _boom(full_text, request):
        raise AttributeError("simulated eval_structural bug")

    monkeypatch.setattr(graph_module, "eval_structural", _boom)

    done = None
    with caplog.at_level("WARNING"):
        async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
            if isinstance(event, DoneEvent):
                done = event

    assert done is not None
    assert done.structural_scores == {}
    assert any("eval_structural" in record.message for record in caplog.records), (
        "Expected a warning log mentioning eval_structural failure"
    )
