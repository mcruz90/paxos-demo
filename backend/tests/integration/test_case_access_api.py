"""Real PostgreSQL plus actual cookie/CSRF middleware; neutral synthetic users."""

from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from security.sessions import COOKIE_NAME, create_session, reset_sessions
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_postgres_foundation import connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres
ROOT = "/api/patients/PAT-X/cases"
KEY = {"idempotency_key": "request-x"}


def seed_access(conn):
    conn.execute(
        "INSERT INTO clearauth_case_principals "
        "(tenant_id,subject_id,actor_id,role,active) VALUES "
        "('tenant-x','staff@example.test','staff-x','coordinator',true)"
    )
    conn.execute("INSERT INTO clearauth_panel_groups VALUES ('tenant-x','group-x')")
    conn.execute("INSERT INTO clearauth_panel_members VALUES ('tenant-x','group-x','staff-x')")
    conn.execute("INSERT INTO clearauth_panel_patients VALUES ('tenant-x','group-x','PAT-X')")


@pytest.fixture
def browser(store_target, monkeypatch):
    from main import app
    from storage import case_service

    reset_sessions()
    with connection_for(store_target) as conn:
        seed_access(conn)

    @contextmanager
    def connect(_config):
        with connection_for(store_target) as conn:
            yield conn

    monkeypatch.setattr(case_service, "checked_connection", connect)
    monkeypatch.setattr(app.state, "database_config", store_target[0], raising=False)
    client = TestClient(app, base_url="https://testserver", raise_server_exceptions=False)
    sid, csrf = create_session("staff@example.test", "tenant-x")
    client.cookies.set(COOKIE_NAME, sid)
    client.headers["X-CSRF-Token"] = csrf
    yield client, store_target
    client.close()
    reset_sessions()


def test_create_replay_read_and_events_use_stored_actor(browser):
    client, target = browser
    created = client.post(ROOT, json=KEY)
    assert created.status_code == 200, created.text
    case = created.json()
    assert case["tenant_id"] == "tenant-x"
    assert case["patient_ref"] == "PAT-X"
    assert client.post(ROOT, json=KEY).json() == case
    path = ROOT + "/" + case["case_id"]
    assert client.get(path).json() == case
    events = client.get(path + "/events").json()
    assert len(events) == 1
    assert events[0]["actor_id"] == "staff-x"
    assert events[0]["event_sequence"] > 0
    # A separate connection sees the response's case and event: success followed commit.
    with connection_for(target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (1,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (1,)


@pytest.mark.parametrize(
    "field", ["tenant_id", "actor_id", "patient_ref", "case_id", "role", "grant"]
)
def test_request_cannot_supply_authority(browser, field):
    client, target = browser
    response = client.post(ROOT, json=KEY | {field: "forged"})
    assert response.status_code == 422
    with connection_for(target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (0,)


@pytest.mark.parametrize(
    "change", ["tenant", "subject", "patient", "membership", "assignment", "principal"]
)
def test_missing_or_revoked_grants_hide_case_and_events(browser, change):
    client, target = browser
    created = client.post(ROOT, json=KEY).json()
    path = ROOT + "/" + created["case_id"]
    if change in {"tenant", "subject"}:
        sid, csrf = create_session(
            "staff@example.test" if change == "tenant" else "unassigned",
            "tenant-y" if change == "tenant" else "tenant-x",
        )
        client.cookies.set(COOKIE_NAME, sid)
        client.headers["X-CSRF-Token"] = csrf
    elif change == "patient":
        path = path.replace("PAT-X", "PAT-Y")
    else:
        with connection_for(target) as conn:
            if change == "membership":
                conn.execute("DELETE FROM clearauth_panel_members")
            elif change == "assignment":
                conn.execute("DELETE FROM clearauth_panel_patients")
            else:
                conn.execute("UPDATE clearauth_case_principals SET active = false")
    assert client.get(path).status_code == 404
    assert client.get(path + "/events").status_code == 404
    create_path = ROOT.replace("PAT-X", "PAT-Y") if change == "patient" else ROOT
    assert client.post(create_path, json={"idempotency_key": "denied"}).status_code == 404


def test_csrf_session_and_service_boundaries(browser, monkeypatch):
    import main

    client, _ = browser
    client.headers.pop("X-CSRF-Token")
    assert client.post(ROOT, json=KEY).status_code == 403
    client.cookies.clear()
    assert client.post(ROOT, json=KEY).status_code == 401
    monkeypatch.setattr(main, "_API_SECRET_KEY", "synthetic-service-key")
    client.headers["Authorization"] = "Bearer synthetic-service-key"
    assert client.post(ROOT, json=KEY).status_code == 401


def test_failed_commit_returns_no_success_and_rolls_back(browser):
    client, target = browser
    with connection_for(target) as conn:
        conn.execute(
            "CREATE FUNCTION fail_commit() RETURNS trigger LANGUAGE plpgsql AS "
            "$$ BEGIN RAISE EXCEPTION 'sensitive-test-message'; END $$"
        )
        conn.execute(
            "CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON clearauth_case_events "
            "DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_commit()"
        )
    response = client.post(ROOT, json=KEY)
    assert response.status_code == 503
    assert response.json() == {"detail": "case_service_unavailable"}
    with connection_for(target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (0,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (0,)


def test_authorized_second_patient_cannot_read_first_patient_case(browser):
    client, target = browser
    case = client.post(ROOT, json=KEY).json()
    with connection_for(target) as conn:
        conn.execute("INSERT INTO clearauth_panel_patients VALUES ('tenant-x','group-x','PAT-Y')")
    path = ROOT.replace("PAT-X", "PAT-Y") + "/" + case["case_id"]
    assert client.get(path).status_code == 404
    assert client.get(path + "/events").status_code == 404
    # Authorization for both patients does not change creation-key identity.
    assert client.post(ROOT.replace("PAT-X", "PAT-Y"), json=KEY).status_code == 409


def test_expired_session_denies_access_without_reusing_cached_grant(browser, monkeypatch):
    from security import sessions

    client, _ = browser
    case = client.post(ROOT, json=KEY).json()
    now = sessions.time.time()
    monkeypatch.setattr(sessions.time, "time", lambda: now + sessions.SESSION_TTL_SECONDS + 1)
    assert client.get(ROOT + "/" + case["case_id"]).status_code == 401
