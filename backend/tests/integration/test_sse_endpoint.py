"""Integration tests for POST /api/appeal/generate — SSE event sequence via TestClient."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setenv("API_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("LLM_BACKEND", "mock")
    from main import app
    return TestClient(app, raise_server_exceptions=False)


def _auth_headers() -> dict:
    return {"Authorization": "Bearer test-secret-key"}


def _valid_payload() -> dict:
    """Payload anchored to the golden Cigna Ozempic pack (CIGNA-CNF360-2024) —
    keep in sync with the ozempic_cigna_clinical_pa scenario so plan_id actually
    resolves via _BY_PLAN_ID instead of silently falling through to the
    drug-alias fallback."""
    return {
        "scenario_id": "ozempic-cigna-clinical-pa",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": (
            "Authorization for Ozempic has been denied. "
            "Indication not confirmed as limited to T2DM glycemic control."
        ),
        "denial_reason": "indication not confirmed as limited to T2DM glycemic control",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "criteria_results": [],
        "company_names": ["Cigna"],
    }


def _parse_sse_events(response_text: str) -> list[dict]:
    """Parse raw SSE text into a list of event dicts."""
    events = []
    current: dict = {}
    for line in response_text.splitlines():
        if line.startswith("event:"):
            current["event"] = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            raw = line.split(":", 1)[1].strip()
            try:
                current["data"] = json.loads(raw)
            except json.JSONDecodeError:
                current["data"] = raw
        elif line == "" and current:
            events.append(current)
            current = {}
    return events


def test_generate_returns_event_stream_content_type(client: TestClient) -> None:
    with client.stream(
        "POST",
        "/api/appeal/generate",
        json=_valid_payload(),
        headers=_auth_headers(),
    ) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]


def test_generate_emits_required_step_events(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/appeal/generate", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    step_names = [e["data"]["step"] for e in events if e.get("event") == "step"]

    assert "ingestion" in step_names
    assert "retrieval" in step_names
    assert "synthesis" in step_names


def test_generate_emits_chunk_events(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/appeal/generate", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    chunks = [e for e in events if e.get("event") == "chunk"]
    assert len(chunks) >= 1
    assert all("text" in c.get("data", {}) for c in chunks)


def test_generate_ends_with_done_event(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/appeal/generate", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    last = events[-1] if events else {}
    assert last.get("event") == "done"
    assert "model" in last.get("data", {})
    assert "ref" in last.get("data", {})


def test_generate_without_auth_returns_401(client: TestClient) -> None:
    response = client.post("/api/appeal/generate", json=_valid_payload())
    assert response.status_code == 401


def test_generate_with_invalid_body_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/appeal/generate",
        json={"scenario_id": "INVALID!!", "drug": "x"},
        headers=_auth_headers(),
    )
    assert response.status_code == 422


def test_generate_step_labels_are_non_empty(client: TestClient) -> None:
    """Each StepEvent must have a non-empty 'label' for the frontend progress display."""
    with client.stream(
        "POST", "/api/appeal/generate", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    for e in events:
        if e.get("event") == "step":
            assert e["data"].get("label", "") != "", "Step label must not be empty"
