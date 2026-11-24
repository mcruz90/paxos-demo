"""Discovery contract against session middleware and a freshly opened store per request."""

from hashlib import sha256

import pytest

from cases.assessment_sources import PediatricFixtureReader
from tests.integration.test_case_access_api import KEY, ROOT
from tests.integration.test_case_access_api import browser as browser
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_postgres_foundation import connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres
QUERY = {"query": "", "expected_revision": 1}


@pytest.fixture
def anchor(browser, monkeypatch):
    from main import app

    client, target = browser
    case = client.post(ROOT, json=KEY).json()
    reader = PediatricFixtureReader(case["case_id"], case["tenant_id"], case["patient_ref"])
    monkeypatch.setattr(app.state, "assessment_reader", reader, raising=False)
    return client, ROOT + "/" + case["case_id"], target


def discover(client, path):
    response = client.post(path + "/discovery", json=QUERY)
    assert response.status_code == 200, response.text
    result = response.json()
    assert client.get(path + "/discovery/" + result["query_id"]).json() == result
    return result["items"]


def command(item, key):
    return {"result_id": item["result_id"], "request_id": key, "expected_revision": 1}


def test_independent_notes_and_exact_reload(anchor):
    client, path, _ = anchor
    a, b = [i for i in discover(client, path) if i["availability"] == "full_text"]
    assert a["category"] == b["category"] and a["source_id"] != b["source_id"]
    url = path + "/attachments"
    before = client.get(path + "/assessment").json()
    assert before["ready"]
    first = client.post(url, json=command(a, "attach-a")).json()
    second = client.post(url, json=command(b, "attach-b")).json()
    assert client.get(url).json() == [first, second]
    assert client.get(path + "/assessment").json() == before
    for attachment, item in ((first, a), (second, b)):
        assert attachment["item"] == item
        assert attachment["actor_id"] == "staff-x" and attachment["attached_at"]
        assert item["source_version_id"] and item["start"] == 0
        assert item["end"] == len(item["excerpt"])
        assert item["content_sha256"] == sha256(item["excerpt"].encode()).hexdigest()
    remove = {"request_id": "remove-a", "expected_revision": 1}
    endpoint = url + "/" + first["attachment_id"]
    removed = client.request("DELETE", endpoint, json=remove)
    assert removed.status_code == 200 and removed.json() == first
    assert client.request("DELETE", endpoint, json=remove).json() == first
    assert client.post(url, json=command(a, "attach-a")).json() == first
    assert client.get(url).json() == [second]


def test_metadata_and_duplicate_attach(anchor):
    client, path, _ = anchor
    item = next(i for i in discover(client, path) if i["availability"] == "metadata_only")
    assert item["excerpt"] is item["start"] is item["end"] is None
    assert len(item["content_sha256"]) == 64
    url = path + "/attachments"
    first = client.post(url, json=command(item, "metadata")).json()
    assert first["item"] == item
    assert client.post(url, json=command(item, "metadata")).json() == first
    assert client.get(url).json() == [first]


def test_foreign_patient_result_and_unbound_case(anchor):
    client, path, target = anchor
    item = discover(client, path)[0]
    with connection_for(target) as conn:
        conn.execute("INSERT INTO clearauth_panel_patients VALUES ('tenant-x','group-x','PAT-Y')")
    root = ROOT.replace("PAT-X", "PAT-Y")
    other = client.post(root, json={"idempotency_key": "other"}).json()
    other_path = root + "/" + other["case_id"]
    assert discover(client, other_path) == []
    assert (
        client.post(other_path + "/attachments", json=command(item, "foreign")).status_code == 404
    )
    assert client.get(other_path + "/attachments").json() == []


def test_revision_and_command_binding(anchor):
    client, path, _ = anchor
    a, b, *_ = discover(client, path)
    url = path + "/attachments"
    body = command(a, "retry")
    assert client.post(url, json=body | {"expected_revision": 2}).status_code == 409
    assert client.get(url).json() == []
    first = client.post(url, json=body).json()
    assert client.post(url, json=command(b, "retry")).status_code == 409
    remove_url = url + "/" + first["attachment_id"]
    remove = {"expected_revision": 2, "request_id": "remove"}
    assert client.request("DELETE", remove_url, json=remove).status_code == 409
    assert client.get(url).json() == [first]
    assert (
        client.post(path + "/discovery", json=QUERY | {"expected_revision": 2}).status_code == 409
    )
    assert client.post(path + "/discovery", json=QUERY | {"query": "x" * 257}).status_code == 422
