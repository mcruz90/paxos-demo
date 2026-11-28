"""The live CLI provisions a replayable, authorized and source-bound pediatric case."""

import runpy

import pytest
from fastapi.testclient import TestClient

from storage import case_service
from tests.integration.test_postgres_foundation import connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database
from tools import seed_live_stack

pytestmark = pytest.mark.postgres
ROOT = "/api/patients/PT-4201/cases"
CASE_ID = "42010000-0000-4000-8000-000000000001"


def test_live_seed_replay_and_bound_routes(isolated_database, monkeypatch, capsys):
    config, _ = isolated_database

    def connect(_config):
        return connection_for(isolated_database)

    monkeypatch.setenv("DEMO_USER", "reviewer")
    monkeypatch.setenv("DEMO_PASSWORD", "synthetic-password")
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@127.0.0.1:55432/clearauth_integration")
    monkeypatch.setattr(seed_live_stack, "checked_connection", connect, raising=False)
    for _ in range(2):
        seed_live_stack.main()
        assert capsys.readouterr().out.strip() == CASE_ID

    monkeypatch.setenv("PEDIATRIC_FIXTURE_CASE_ID", CASE_ID)
    app = runpy.run_module("main")["app"]
    app.state.database_config = config
    monkeypatch.setattr(case_service, "checked_connection", connect)
    client = TestClient(app, base_url="https://testserver")
    try:
        login = client.post(
            "/api/auth/login", json={"username": "reviewer", "password": "synthetic-password"}
        )
        assert login.status_code == 200
        client.headers["X-CSRF-Token"] = login.json()["csrf_token"]
        replay = client.post(ROOT, json={"idempotency_key": "journey-anchor-pediatric"})
        assert replay.status_code == 200 and replay.json()["case_id"] == CASE_ID
        path = f"{ROOT}/{CASE_ID}"
        assessment = client.get(path + "/assessment")
        assert assessment.status_code == 200 and assessment.json()["pathway"] == "swallowing"
        discovery = client.post(path + "/discovery", json={"expected_revision": 1, "query": ""})
        assert discovery.status_code == 200
        assert "gi-2026-10-21-v1" in {
            item["source_version_id"] for item in discovery.json()["items"]
        }
    finally:
        client.close()
    with connect(config) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (1,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (1,)
