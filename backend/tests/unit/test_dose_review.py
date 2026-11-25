"""Public behavior of the separately bound synthetic dose discrepancy."""

import re
from dataclasses import dataclass, replace
from hashlib import sha256
from types import SimpleNamespace

import pytest

from api.assessment import public_assessment
from cases.assessment_sources import PediatricFixtureReader
from tests.unit.test_duration_approval import CASE as ANCHOR
from tests.unit.test_duration_approval import READER as ANCHOR_READER

CASE = ANCHOR.model_copy(update={"case_id": "dose-case", "patient_ref": "PT-4202"})


@dataclass(frozen=True)
class BoundReader(PediatricFixtureReader):
    dose_case_id: str | None = CASE.case_id


READER = BoundReader(tenant_id=CASE.tenant_id)


def inputs():
    records = READER.read(CASE)
    assert records and records.dose_documents, "missing bound synthetic dose sources"
    return records


def assess(**changes):
    records = inputs()
    docs = replace(records.dose_documents, **changes)
    reader = SimpleNamespace(read=lambda _: replace(records, dose_documents=docs))
    return public_assessment(CASE, reader)


def test_review_cites_three_sources_and_preserves_initial_readiness():
    data = public_assessment(CASE, READER).model_dump()
    review = data.get("dose_review")
    assert review, "the documented 20/10 discrepancy has no review"
    assert review["status"] == "staff_review_hold"
    assert review["finding"] == "20 mg requested, 10 mg approved; limit not in the policy text."
    for key, words in (("prescription", "20 mg"), ("letter", "10 mg"), ("policy", "Not stated.")):
        assert words in review[key]["excerpt"]
        assert review[key]["locator"]
    assert len({review[key]["locator"] for key in ("prescription", "letter", "policy")}) == 3
    assert review["synthetic"] and review["label_status"] == "current label check pending"
    baseline = public_assessment(
        CASE, SimpleNamespace(read=lambda _: replace(inputs(), dose_documents=None))
    )
    assert baseline.model_dump() == {k: v for k, v in data.items() if k != "dose_review"}


@pytest.mark.parametrize(
    "policy", [None, "Unreadable section", "Not stated.\nAdditional restriction"]
)
def test_policy_could_not_be_checked(policy):
    review = assess(policy=policy).dose_review
    assert "policy could not be checked" in review.finding.lower()
    assert "limit not in" not in review.finding and review.policy is None


def test_repeat_or_conflicting_answer_keeps_one_unsent_question():
    initial = assess().dose_review
    assert initial == assess().dose_review
    review = assess(payer_answer="Synthetic payer reply: the decision was 15 mg.").dose_review
    assert review.status == "staff_review_hold"
    assert review.next_action == initial.next_action
    assert review.next_action.owner == "assigned case reviewer"
    assert review.next_action.status == "draft"
    for term in ("plan rule", "product strength", "units per day", "effective date", "10 mg"):
        assert term in review.next_action.question.lower()


def test_finding_follows_sources_and_avoids_unsupported_conclusions():
    docs = inputs().dose_documents
    review = assess(
        prescription=docs.prescription.replace("20 mg", "30 mg"),
        letter=docs.letter.replace("10 mg", "15 mg"),
    ).dose_review
    assert review.finding.startswith("30 mg requested, 15 mg approved")
    assert "15 mg" in review.next_action.question
    assert not re.search(
        r"plan maximum|subtherapeutic|adequate|must cover|maximum dose",
        assess().model_dump_json(),
        re.I,
    )


@pytest.mark.parametrize("days", [28, 56])
def test_documented_matching_dose_has_no_hold(days):
    letter = (
        inputs().dose_documents.letter.replace("10 mg", "20 mg").replace("56 days", f"{days} days")
    )
    assert f"{days} days" in letter
    assert assess(letter=letter).dose_review is None


def test_anchor_response_bytes_and_fixture_scope():
    payload = public_assessment(ANCHOR, ANCHOR_READER).model_dump_json()
    assert (
        sha256(payload.encode()).hexdigest()
        == "178137180c87525855ed6581b60580419d80c9a6c87f42613fc2101f4fd6ca3e"
    )
    for field, value in (
        ("tenant_id", "other"),
        ("case_id", "other"),
        ("patient_ref", "PT-9"),
        ("revision", 2),
    ):
        assert READER.read(CASE.model_copy(update={field: value})) is None
