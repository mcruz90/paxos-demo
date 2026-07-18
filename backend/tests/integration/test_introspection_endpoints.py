"""Integration tests — read-only introspection endpoints (S3 Task 3).

``GET /api/audit/records`` and ``GET /api/reviews/pending`` are Bearer-gated,
metadata-only surfaces over the in-memory audit store + the parked-run review
queue. Acceptance (task spec):

- both 401 without a token;
- a parked exception run appears in ``/api/reviews/pending`` and disappears
  after resume;
- a resumed / unknown correlation_id never appears;
- ``/api/audit/records`` shows BOTH the ``as_is`` draft and the
  ``human_edited`` resume record for a resumed run.

Run from backend/:
    uv run pytest tests/integration/test_introspection_endpoints.py -v
"""

from __future__ import annotations

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
    monkeypatch.setenv("LLM_BACKEND", "mock")
    from main import app

    return TestClient(app, raise_server_exceptions=False)


def _auth() -> dict:
    return {"Authorization": "Bearer test-secret-key"}


def _exception_payload(scenario_id: str) -> dict:
    # Empty criteria → exception tier (no criteria to assess) → parks at hold.
    return {
        "scenario_id": scenario_id,
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": "Authorization denied.",
        "denial_reason": "step therapy",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "criteria_results": [],
    }


def _parse_sse(body: str) -> list[dict]:
    import json

    events, current = [], {}
    for line in body.splitlines():
        if line.startswith("event:"):
            current["event"] = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            current["data"] = json.loads(line.split(":", 1)[1].strip())
        elif line == "" and current:
            events.append(current)
            current = {}
    return events


def _park(client: TestClient, scenario_id: str) -> str:
    """Drive an exception run through the generate endpoint (parks at hold);
    return its correlation_id."""
    with client.stream(
        "POST", "/api/appeal/generate", json=_exception_payload(scenario_id), headers=_auth()
    ) as resp:
        body = resp.read().decode()
    done = next(e for e in _parse_sse(body) if e["event"] == "done")
    assert done["data"]["tier"] == "exception"
    return done["data"]["correlation_id"]


def _resume(client: TestClient, correlation_id: str) -> None:
    with client.stream(
        "POST", "/api/appeal/resume", json={"correlation_id": correlation_id}, headers=_auth()
    ) as resp:
        resp.read()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def test_audit_records_requires_auth(client: TestClient) -> None:
    assert client.get("/api/audit/records").status_code == 401


def test_pending_reviews_requires_auth(client: TestClient) -> None:
    assert client.get("/api/reviews/pending").status_code == 401


# ---------------------------------------------------------------------------
# /api/reviews/pending
# ---------------------------------------------------------------------------


def test_parked_run_appears_then_disappears_after_resume(client: TestClient) -> None:
    corr = _park(client, "introspect-park")

    pending = client.get("/api/reviews/pending", headers=_auth()).json()["reviews"]
    entry = next((r for r in pending if r["correlation_id"] == corr), None)
    assert entry is not None, "a parked exception run must appear in the queue"
    assert entry["tier"] == "exception"
    assert entry["drug"] == "Ozempic (semaglutide)"
    assert entry["scenario_id"] == "introspect-park"
    assert entry["parked_at"]  # non-empty timestamp

    _resume(client, corr)

    pending_after = client.get("/api/reviews/pending", headers=_auth()).json()["reviews"]
    assert all(r["correlation_id"] != corr for r in pending_after), (
        "a resumed run must drop out of the pending queue"
    )


def test_unknown_correlation_id_never_appears(client: TestClient) -> None:
    # Nothing parked at all → empty queue (no crawling of stray checkpoints).
    assert client.get("/api/reviews/pending", headers=_auth()).json()["reviews"] == []


# ---------------------------------------------------------------------------
# /api/audit/records
# ---------------------------------------------------------------------------


def test_audit_records_shows_both_draft_and_human_sign_off(client: TestClient) -> None:
    corr = _park(client, "introspect-audit")
    _resume(client, corr)  # no edited_text ⇒ approved as-is (ADR-0009 amendment)

    records = client.get("/api/audit/records", headers=_auth()).json()["records"]
    for_corr = [r for r in records if r["correlation_id"] == corr]
    provenances = {r["provenance"] for r in for_corr}
    assert provenances == {"as_is", "human_approved"}, (
        "the audit listing must show both the machine draft and the human sign-off"
    )


def test_audit_records_empty_before_any_run(client: TestClient) -> None:
    assert client.get("/api/audit/records", headers=_auth()).json()["records"] == []
