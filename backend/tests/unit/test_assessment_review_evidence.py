"""Public assessment projection for authorized chart review."""

from dataclasses import replace
from datetime import date

import pytest

from api.assessment import CaseAssessment, public_assessment
from cases.assessment_sources import PediatricFixtureReader
from tests.unit.test_case_readiness import CASE, source


def review(body, dob=date(2019, 1, 15)):
    class Reader(PediatricFixtureReader):
        def read(self, case):
            inputs = super().read(case)
            return replace(
                inputs, sources=(source(body),), dob=dob, service_date=date(2026, 10, 23)
            )

    return public_assessment(CASE, Reader(CASE.case_id, CASE.tenant_id, CASE.patient_ref))


@pytest.mark.parametrize(
    ("key", "line"),
    [
        ("omeprazole", "Prescription omeprazole: intolerance: witnessed choking."),
        ("source_review", "Unclassified chart note with a private detail."),
    ],
)
def test_public_citation_has_exact_location(key, line):
    body = "Diagnosis: K21.0.\n" + line
    result = review(body).model_dump()
    row = next(row for row in result["findings"] if row["criterion_id"] == key)
    (cite,) = row["evidence"]
    assert cite["source_version_id"] == "chart" and cite["role"] == "patient"
    assert body[cite["start"] : cite["end"]] == line
    if key == "source_review":
        assert line not in str(result) and cite.get("excerpt") is None
    else:
        assert cite["excerpt"] == line


@pytest.mark.parametrize(
    ("dob", "years", "status"),
    [
        (date(1901, 10, 23), 125, "met"),
        (date(1900, 10, 23), None, "conflict"),
    ],
)
def test_age_limit_preserves_a_valid_response(dob, years, status):
    result = review(f"Age at request: {2026 - dob.year} years.", dob)
    assert result.age_years == years
    assert next(row for row in result.findings if row.criterion_id == "age").status == status
    assert (
        CaseAssessment.model_json_schema()["properties"]["age_years"]["anyOf"][0]["maximum"] == 125
    )
