"""Resume HTTP contract for deterministic review of the outbound letter."""

import pytest
from fastapi.testclient import TestClient

from tests.integration.test_resume import (
    _auth_headers,
    _clean_audit_log,
    _exception_payload,
    _parse_sse_events,
    client,
)

__all__ = ["_clean_audit_log", "client"]


def _park(client: TestClient) -> tuple[str, str]:
    response = client.post(
        "/api/appeal/generate", headers=_auth_headers(), json=_exception_payload("resume-gate")
    )
    events = _parse_sse_events(response.text)
    draft = "".join(e["data"]["text"] for e in events if e["event"] == "chunk")
    return events[-1]["data"]["correlation_id"], draft


def _resume(client: TestClient, corr: str, text: str | None) -> list[dict]:
    response = client.post(
        "/api/appeal/resume",
        headers=_auth_headers(),
        json={"correlation_id": corr, "edited_text": text},
    )
    assert response.status_code == 200
    return _parse_sse_events(response.text)


def _records(client: TestClient, corr: str) -> list[dict]:
    rows = client.get("/api/audit/records", headers=_auth_headers()).json()["records"]
    return [row for row in rows if row["correlation_id"] == corr]


def test_rejected_edit_remains_reviewable_until_corrected(client: TestClient) -> None:
    corr, draft = _park(client)
    rejected = _resume(client, corr, draft + " As an AI assistant, I cannot assist.")
    assert [e["event"] for e in rejected] == ["error"]
    assert "Refusal or AI-identity" in rejected[0]["data"]["message"]
    assert rejected[0]["data"]["resume_gate"] == "edit_failed"
    pending = client.get("/api/reviews/pending", headers=_auth_headers()).json()["reviews"]
    assert corr in [row["correlation_id"] for row in pending]

    accepted = _resume(client, corr, draft + " Reviewed by staff.")
    assert [e["event"] for e in accepted] == ["done"]
    assert accepted[0]["data"]["resume_gate"] == "edit_passed"
    records = _records(client, corr)
    assert [(r["provenance"], r["resume_gate"], r["gatekeeper_passed"]) for r in records[1:]] == [
        ("human_edited", "edit_failed", False),
        ("human_edited", "edit_passed", True),
    ]


@pytest.mark.parametrize("send_draft", [False, True])
def test_approve_as_is_reuses_parked_verdict(client: TestClient, send_draft: bool) -> None:
    corr, draft = _park(client)
    events = _resume(client, corr, draft if send_draft else None)
    assert [e["event"] for e in events] == ["done"]
    assert events[0]["data"]["resume_gate"] == "draft_reused"
    record = _records(client, corr)[-1]
    assert (record["provenance"], record["resume_gate"]) == ("human_approved", "draft_reused")
