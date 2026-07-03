"""Integration tests for POST /api/pa/submit — initial-PA SSE endpoint (S2 Slice 5).

Same contract family as /api/appeal/generate: Bearer auth before body
parsing, text/event-stream, terminal done|error guarantee — but the done
payload is InitialPaDoneEvent and the stream never carries chunk events
(no LLM in this path; no LLM_BACKEND required to serve it).
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from audit.store import reset_audit_log


@pytest.fixture(autouse=True)
def _clean_audit_log():
    reset_audit_log()
    yield
    reset_audit_log()


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setenv("API_SECRET_KEY", "test-secret-key")
    # Deliberately NO LLM_BACKEND — the initial-PA route must not need one.
    monkeypatch.delenv("LLM_BACKEND", raising=False)
    from main import app
    return TestClient(app, raise_server_exceptions=False)


def _auth_headers() -> dict:
    return {"Authorization": "Bearer test-secret-key"}


def _valid_payload() -> dict:
    """Anchored to the golden Cigna Ozempic pack (CIGNA-CNF360-2024) so the
    CRD check resolves via plan_id."""
    return {
        "scenario_id": "novo-ozempic-initial",
        "case_ref": "PA-2026-0847",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic 0.5 mg subcutaneous weekly",
        "criteria_results": [
            {
                "rule": {"type": "diagnostic", "label": "Type 2 Diabetes Mellitus"},
                "status": "found",
                "note": "E11.9 documented",
            }
        ],
    }


def _parse_sse_events(response_text: str) -> list[dict]:
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


def test_pa_submit_returns_event_stream_content_type(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/pa/submit", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]


def test_pa_submit_emits_lifecycle_steps_and_no_chunks(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/pa/submit", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    step_names = [e["data"]["step"] for e in events if e.get("event") == "step"]
    assert step_names == ["crd_check", "assemble", "pas_submit", "determination"]
    assert not [e for e in events if e.get("event") == "chunk"]


def test_pa_submit_ends_with_initial_pa_done_event(client: TestClient) -> None:
    with client.stream(
        "POST", "/api/pa/submit", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        body = resp.read().decode()

    events = _parse_sse_events(body)
    last = events[-1] if events else {}
    assert last.get("event") == "done"
    data = last.get("data", {})
    assert data.get("pa_required", {}).get("required") is True
    assert data.get("outcome", {}).get("decision") == "approved"
    assert data.get("submission_ref", "").startswith("PAS-")
    assert data.get("correlation_id") == "PA-2026-0847:a1"


def test_pa_submit_without_auth_returns_401(client: TestClient) -> None:
    response = client.post("/api/pa/submit", json=_valid_payload())
    assert response.status_code == 401


def test_pa_submit_with_invalid_body_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/pa/submit",
        json={"scenario_id": "INVALID!!", "drug": "x"},
        headers=_auth_headers(),
    )
    assert response.status_code == 422


def test_pa_submit_rejects_appeal_shaped_body(client: TestClient) -> None:
    """A denial-shaped payload does not belong on the initial-PA route —
    strict validation rejects unknown/missing fields rather than silently
    accepting an appeal request here."""
    payload = _valid_payload()
    del payload["requested_therapy"]
    response = client.post("/api/pa/submit", json=payload, headers=_auth_headers())
    assert response.status_code == 422


def test_pa_submit_writes_one_audit_record(client: TestClient) -> None:
    from audit.store import all_records

    with client.stream(
        "POST", "/api/pa/submit", json=_valid_payload(), headers=_auth_headers()
    ) as resp:
        resp.read()

    records = all_records()
    assert len(records) == 1
    assert records[0].correlation_id == "PA-2026-0847:a1"
