"""Integration — tenant isolation at the read endpoints (P7a Slice 4, ADR-0017).

End-to-end proof of the fail-closed scope wired through the auth middleware: a
cookie session is scoped to its ``tenant_id`` claim (the seeded ``tenant_demo``),
so ``GET /api/audit/records`` and ``GET /api/reviews/pending`` return only that
tenant's rows; a Bearer / service caller is platform-plane and still sees every
tenant. A foreign-tenant record is seeded directly in the store (audit listing)
and via a foreign-tenant run (review queue) to prove the filter, not just its
absence.

Run from backend/:
    uv run pytest tests/integration/test_tenancy_enforcement.py -v
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from audit.store import reset_audit_log, write_audit_record
from models.schemas import AuditRecord, CaseLifecycle
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


def _bearer() -> dict:
    return {"Authorization": "Bearer test-secret-key"}


def _login(client: TestClient) -> str:
    resp = client.post(
        "/api/auth/login", json={"username": "demo", "password": "demo-pass"}
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["csrf_token"]


def _seed_record(correlation_id: str, tenant_id: str) -> None:
    write_audit_record(
        AuditRecord(
            correlation_id=correlation_id,
            idempotency_key=correlation_id,
            tenant_id=tenant_id,
            lifecycle=CaseLifecycle.appeal,
            scenario_id="seeded-scn",
            drug="Ozempic (semaglutide)",
            plan="Cigna Connect 500 PPO",
            timestamp="2026-07-18T12:00:00+00:00",
            duration_ms=1,
            outcome="done",
            provenance="as_is",  # type: ignore[arg-type]
        )
    )


def _exception_payload(scenario_id: str, tenant_id: str) -> dict:
    # Empty criteria → exception tier → parks at hold; tenant_id rides the body
    # (pre-DB) and is stamped on the audit record.
    return {
        "scenario_id": scenario_id,
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": "Authorization denied.",
        "denial_reason": "step therapy",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "criteria_results": [],
        "tenant_id": tenant_id,
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


def _park(client: TestClient, scenario_id: str, tenant_id: str) -> str:
    with client.stream(
        "POST",
        "/api/appeal/generate",
        json=_exception_payload(scenario_id, tenant_id),
        headers=_bearer(),
    ) as resp:
        body = resp.read().decode()
    done = next(e for e in _parse_sse(body) if e["event"] == "done")
    assert done["data"]["tier"] == "exception"
    return done["data"]["correlation_id"]


# ---------------------------------------------------------------------------
# GET /api/audit/records
# ---------------------------------------------------------------------------


def test_session_audit_records_sees_only_its_tenant(client: TestClient) -> None:
    _seed_record("home:a1", "tenant_demo")
    _seed_record("foreign:a1", "tenant_other")

    _login(client)
    records = client.get("/api/audit/records").json()["records"]  # cookie auth
    corr_ids = {r["correlation_id"] for r in records}
    assert corr_ids == {"home:a1"}, "a session must not see another tenant's records"


def test_bearer_audit_records_sees_every_tenant(client: TestClient) -> None:
    _seed_record("home:a1", "tenant_demo")
    _seed_record("foreign:a1", "tenant_other")

    records = client.get("/api/audit/records", headers=_bearer()).json()["records"]
    corr_ids = {r["correlation_id"] for r in records}
    assert corr_ids == {"home:a1", "foreign:a1"}, "the platform plane sees all tenants"


# ---------------------------------------------------------------------------
# GET /api/reviews/pending
# ---------------------------------------------------------------------------


def test_session_pending_reviews_sees_only_its_tenant(client: TestClient) -> None:
    home = _park(client, "enforce-home", "tenant_demo")
    foreign = _park(client, "enforce-foreign", "tenant_other")

    _login(client)
    pending = client.get("/api/reviews/pending").json()["reviews"]  # cookie auth
    corr_ids = {r["correlation_id"] for r in pending}
    assert home in corr_ids, "a session must see its own tenant's parked run"
    assert foreign not in corr_ids, "a session must not see another tenant's parked run"


def test_bearer_pending_reviews_sees_every_tenant(client: TestClient) -> None:
    home = _park(client, "enforce-home", "tenant_demo")
    foreign = _park(client, "enforce-foreign", "tenant_other")

    pending = client.get("/api/reviews/pending", headers=_bearer()).json()["reviews"]
    corr_ids = {r["correlation_id"] for r in pending}
    assert {home, foreign} <= corr_ids, "the platform plane sees every tenant's queue"
