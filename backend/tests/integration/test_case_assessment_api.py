"""The bound synthetic reader in the authorized PostgreSQL case route."""

import pytest

from tests.integration.test_case_access_api import KEY, ROOT
from tests.integration.test_case_access_api import browser as browser
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres


def test_bound_fixture_returns_only_its_case_and_revision(browser, monkeypatch):
    from api.assessment import assessment_reader
    from cases.assessment_sources import PediatricFixtureReader
    from main import app
    from models.case_evidence import CaseRecord

    client, _ = browser
    case = client.post(ROOT, json=KEY).json()
    reader = PediatricFixtureReader(case["case_id"], case["tenant_id"], case["patient_ref"])
    path = ROOT + "/" + case["case_id"]
    monkeypatch.setitem(
        app.dependency_overrides, assessment_reader, lambda: PediatricFixtureReader()
    )
    unbound = client.get(path + "/assessment").json()
    assert unbound["blockers"] == ["sources"] and not unbound["findings"]
    monkeypatch.setitem(app.dependency_overrides, assessment_reader, lambda: reader)
    response = client.get(path + "/assessment")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["age_years"] == 7 and data["blockers"] == []
    assert data["ready"] and data["revision"] == case["revision"]
    assert data["pathway"] == "swallowing"
    rows = {row["criterion_id"]: row for row in data["findings"]}
    assert rows["swallowing"]["status"] == "met"
    for drug in ("omeprazole", "pantoprazole", "rabeprazole"):
        assert rows[drug]["status"] == "missing" and rows[drug]["next_action"]
    assert all(
        value not in response.text
        for value in ("2019-01-15", "2026-10-23", "service_date", '"dob"')
    )
    inputs = reader.read(CaseRecord(**case))
    sources = {source.source_version_id: source for source in inputs.sources}
    for row in data["findings"]:
        for cite in row["evidence"]:
            source = sources[cite["source_version_id"]]
            assert cite["source_sha256"] == source.body_sha256
            assert cite["excerpt"] == source.body[cite["start"] : cite["end"]]
    assert len(client.get(path + "/events").json()) == 1
    assert reader.read(CaseRecord(**(case | {"revision": 2}))) is None
    other = client.post(ROOT, json={"idempotency_key": "another-case"}).json()
    assert client.get(ROOT + "/" + other["case_id"] + "/assessment").json()["blockers"] == [
        "sources"
    ]
