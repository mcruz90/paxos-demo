"""Integration tests — session-cookie auth beside Bearer (Slice 2, ADR-0013).

FastAPI is its own BFF: browsers authenticate with an httpOnly ``paxos_session``
cookie; the smoke-tour / CI keep using ``Authorization: Bearer``. These tests
pin the dual-auth middleware contract:

* login success / failure,
* a cookie-authenticated request with no Bearer key is accepted,
* a cookie-authenticated non-GET without ``X-CSRF-Token`` is rejected (403),
* Bearer requests are exempt from the CSRF check,
* logout destroys the session,
* GET /api/auth/me reflects the session (401 without one).

The TestClient uses an ``https`` base_url so the ``Secure`` cookie is echoed by
the httpx cookie jar (it withholds Secure cookies over plain http).
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from audit.store import all_records, reset_audit_log
from security import sessions


@pytest.fixture
def client(monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("API_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("DEMO_USER", "demo")
    monkeypatch.setenv("DEMO_PASSWORD", "demo-pass")
    monkeypatch.setenv("LLM_BACKEND", "mock")
    sessions.reset_sessions()
    reset_audit_log()
    from main import app

    yield TestClient(app, base_url="https://testserver", raise_server_exceptions=False)
    sessions.reset_sessions()
    reset_audit_log()


def _login(client: TestClient) -> str:
    """Log in on the shared client (cookie lands in the jar); return csrf_token."""
    resp = client.post(
        "/api/auth/login", json={"username": "demo", "password": "demo-pass"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["csrf_token"]


# ---------------------------------------------------------------------------
# login
# ---------------------------------------------------------------------------


def test_login_success_sets_cookie_and_returns_csrf(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login", json={"username": "demo", "password": "demo-pass"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] == "demo"
    assert body["csrf_token"]
    assert "paxos_session" in resp.cookies


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login", json={"username": "demo", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert "paxos_session" not in resp.cookies


def test_login_is_unauthenticated(client: TestClient) -> None:
    """Login is the credential-issuing route — it must not itself require auth."""
    resp = client.post(
        "/api/auth/login", json={"username": "demo", "password": "demo-pass"}
    )
    assert resp.status_code != 401


# ---------------------------------------------------------------------------
# cookie-authenticated access + CSRF
# ---------------------------------------------------------------------------


def test_cookie_auth_grants_get_without_bearer(client: TestClient) -> None:
    _login(client)
    resp = client.get("/api/audit/records")  # no Authorization header
    assert resp.status_code == 200


def test_cookie_post_without_csrf_is_rejected(client: TestClient) -> None:
    _login(client)
    resp = client.post("/api/appeal/resume", json={"correlation_id": "x:a1"})
    assert resp.status_code == 403


def test_cookie_post_with_csrf_is_accepted(client: TestClient) -> None:
    csrf = _login(client)
    resp = client.post(
        "/api/appeal/resume",
        json={"correlation_id": "never-parked:a1"},
        headers={"X-CSRF-Token": csrf},
    )
    # Unknown run streams an in-stream error, but the HTTP request is accepted.
    assert resp.status_code == 200


def test_cookie_post_with_wrong_csrf_is_rejected(client: TestClient) -> None:
    _login(client)
    resp = client.post(
        "/api/appeal/resume",
        json={"correlation_id": "x:a1"},
        headers={"X-CSRF-Token": "forged"},
    )
    assert resp.status_code == 403


def test_no_auth_at_all_is_401(client: TestClient) -> None:
    resp = client.get("/api/audit/records")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Bearer path unchanged — exempt from CSRF
# ---------------------------------------------------------------------------


def test_bearer_post_is_exempt_from_csrf(client: TestClient) -> None:
    resp = client.post(
        "/api/appeal/resume",
        json={"correlation_id": "never-parked:a1"},
        headers={"Authorization": "Bearer test-secret-key"},
    )
    assert resp.status_code == 200  # no X-CSRF-Token, still accepted


# ---------------------------------------------------------------------------
# me + logout
# ---------------------------------------------------------------------------


def test_me_returns_user_for_valid_session(client: TestClient) -> None:
    _login(client)
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["user_id"] == "demo"


def test_me_without_session_is_401(client: TestClient) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_logout_destroys_session(client: TestClient) -> None:
    csrf = _login(client)
    resp = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 204
    # The session is gone: /me now 401s even though the jar may resend the cookie.
    assert client.get("/api/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Actor attribution — reviewed_by threaded through the resume audit record
# ---------------------------------------------------------------------------


def _exception_payload(scenario_id: str) -> dict:
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


def _park_via_stream(client: TestClient, scenario_id: str, headers: dict) -> str:
    with client.stream(
        "POST",
        "/api/appeal/generate",
        json=_exception_payload(scenario_id),
        headers=headers,
    ) as resp:
        body = resp.read().decode()
    done = next(e for e in _parse_sse(body) if e["event"] == "done")
    assert done["data"]["tier"] == "exception"
    return done["data"]["correlation_id"]


def _resume_record():
    return next(r for r in all_records() if r.idempotency_key.endswith(":resume"))


def test_cookie_resume_sets_reviewed_by_to_session_user(client: TestClient) -> None:
    csrf = _login(client)
    headers = {"X-CSRF-Token": csrf}
    corr = _park_via_stream(client, "reviewed-by-cookie", headers)
    with client.stream(
        "POST",
        "/api/appeal/resume",
        json={"correlation_id": corr},
        headers=headers,
    ) as resp:
        resp.read()
    assert _resume_record().reviewed_by == "demo"


def test_bearer_resume_leaves_reviewed_by_empty(client: TestClient) -> None:
    headers = {"Authorization": "Bearer test-secret-key"}
    corr = _park_via_stream(client, "reviewed-by-bearer", headers)
    with client.stream(
        "POST",
        "/api/appeal/resume",
        json={"correlation_id": corr},
        headers=headers,
    ) as resp:
        resp.read()
    assert _resume_record().reviewed_by == ""
