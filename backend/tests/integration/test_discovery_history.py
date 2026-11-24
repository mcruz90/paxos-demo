"""T-24 discovery replay, query history and additive wire contracts."""

from datetime import datetime

import pytest

from tests.integration.test_case_access_api import ROOT
from tests.integration.test_case_access_api import browser as browser
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_discovery_api import QUERY, command, discover
from tests.integration.test_discovery_api import anchor as anchor
from tests.integration.test_postgres_foundation import connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

PREFIX = "/api/patients/{patient_ref}/cases/{case_id}"


def test_documented_discovery_errors():
    from main import app

    schema = app.openapi()
    for route, method in (
        ("/discovery", "post"),
        ("/discovery/{query_id}", "get"),
        ("/attachments", "get"),
        ("/attachments", "post"),
        ("/attachments/{attachment_id}", "delete"),
    ):
        responses = schema["paths"][PREFIX + route][method]["responses"]
        for status in ("404", "409", "503"):
            assert status in responses
            ref = responses[status]["content"]["application/json"]["schema"]["$ref"]
            fields = schema["components"]["schemas"][ref.split("/")[-1]]["properties"]
            assert "detail" in fields
            if status == "409":
                assert set(fields["code"]["enum"]) == {
                    "stale_case_revision",
                    "idempotency_conflict",
                }


def assert_conflict(response, code):
    assert response.status_code == 409
    assert response.json() == {"detail": "case_conflict", "code": code}


@pytest.mark.postgres
def test_attachment_conflict_causes(anchor):
    client, path, _ = anchor
    a, b, *_ = discover(client, path)
    url = path + "/attachments"
    body = command(a, "one")
    assert_conflict(client.post(url, json=body | {"expected_revision": 2}), "stale_case_revision")
    assert client.post(url, json=body).status_code == 200
    assert_conflict(client.post(url, json=command(b, "one")), "idempotency_conflict")


@pytest.mark.postgres
def test_keyed_search_replays_after_revision_change(anchor):
    client, path, target = anchor
    url = path + "/discovery"
    body = QUERY | {"request_id": "retry.1"}
    first = client.post(url, json=body)
    assert first.status_code == 200
    with connection_for(target) as conn:
        conn.execute("UPDATE clearauth_cases SET revision=2")
    assert client.post(url, json=body).json() == first.json()
    for change in ({"query": "different"}, {"expected_revision": 2}):
        assert_conflict(client.post(url, json=body | change), "idempotency_conflict")
    assert_conflict(client.post(url, json=QUERY), "stale_case_revision")
    with connection_for(target) as conn:
        assert conn.execute("SELECT count(*) FROM discovery_queries").fetchone() == (1,)
        assert conn.execute("SELECT count(*) FROM discovery_results").fetchone() == (
            len(first.json()["items"]),
        )
    for invalid in ("", "bad id", "x" * 129):
        assert client.post(url, json=body | {"request_id": invalid}).status_code == 422


@pytest.mark.postgres
def test_case_query_history(anchor):
    client, path, target = anchor
    url = path + "/discovery"
    assert client.get(url).status_code == 200
    assert client.get(url).json() == []
    snapshots = [client.post(url, json=QUERY).json() for _ in range(2)]
    snapshots.append(client.post(url, json=QUERY | {"query": "absent-query"}).json())
    history = client.get(url).json()
    assert len(history) == 3
    for row, snapshot in zip(history, reversed(snapshots), strict=True):
        assert row["query_id"] == snapshot["query_id"]
        assert row["query"] == snapshot["query"] and row["revision"] == snapshot["revision"]
        assert row["item_count"] == len(snapshot["items"])
        assert datetime.fromisoformat(row["created_at"]).utcoffset() is not None
    assert client.get(url, params={"limit": 1}).json() == history[:1]
    for limit in (0, 51):
        assert client.get(url, params={"limit": limit}).status_code == 422
    other = client.post(ROOT, json={"idempotency_key": "second-case"}).json()
    assert client.get(ROOT + "/" + other["case_id"] + "/discovery").json() == []
    with connection_for(target) as conn:
        conn.execute("DELETE FROM clearauth_panel_patients")
    denied = client.get(url)
    assert denied.status_code == 404 and denied.json() == {"detail": "case_not_found"}
