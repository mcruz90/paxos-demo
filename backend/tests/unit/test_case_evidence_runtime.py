"""Synthetic infrastructure checks; no medical criteria or gold labels."""

from hashlib import sha256

import pytest
from pydantic import ValidationError

from cases.evidence import prepare_attachment
from models.schemas import CaseRecord, EvidenceAttachRequest, SourceVersion


def records():
    case = CaseRecord(case_id="case-a", tenant_id="tenant_a", patient_ref="PT-A", revision=3)
    body = "Record: A😀B tablet note."
    source = SourceVersion(
        source_version_id="source-v1",
        case_id="case-a",
        tenant_id="tenant_a",
        category="patient_record",
        patient_ref="PT-A",
        body=body,
        body_sha256=sha256(body.encode()).hexdigest(),
        origin_ref="synthetic:record-a",
    )
    request = EvidenceAttachRequest(
        source_version_id="source-v1",
        expected_case_revision=3,
        idempotency_key="request-a",
        start=8,
        end=11,
        excerpt="A😀B",
        role="context",
    )
    return case, source, request


def test_exact_unicode_excerpt_is_preserved_without_mutating_case():
    case, source, request = records()
    attachment = prepare_attachment(case, source, request, "attachment-a", "staff-a")
    assert attachment.excerpt == "A😀B"
    assert attachment.source_sha256 == source.body_sha256
    assert attachment.excerpt_sha256 == sha256("A😀B".encode()).hexdigest()
    assert attachment.source_version_id == "source-v1"
    assert case.revision == 3
    with pytest.raises(ValidationError):
        attachment.excerpt = "altered"


@pytest.mark.parametrize(
    "change",
    [
        {"tenant_id": "tenant_b"},
        {"case_id": "case-b"},
        {"patient_ref": "PT-B"},
        {"body_sha256": "0" * 64},
        {"source_version_id": "source-v2"},
    ],
)
def test_wrong_scope_version_or_body_is_rejected(change):
    case, source, request = records()
    source = SourceVersion.model_validate({**source.model_dump(), **change})
    with pytest.raises(ValueError):
        prepare_attachment(case, source, request, "attachment-a", "staff-a")


@pytest.mark.parametrize(
    "change",
    [
        {"expected_case_revision": 2},
        {"start": 9, "end": 12},
        {"start": 97, "end": 100},
        {"excerpt": "XYZ"},
    ],
)
def test_stale_or_inexact_attachment_is_rejected(change):
    case, source, request = records()
    request = EvidenceAttachRequest.model_validate({**request.model_dump(), **change})
    with pytest.raises(ValueError):
        prepare_attachment(case, source, request, "attachment-a", "staff-a")


@pytest.mark.parametrize("extra", ["tenant_id", "actor_id", "criterion_satisfied", "gold_ready"])
def test_request_cannot_claim_scope_actor_or_findings(extra):
    _, _, request = records()
    with pytest.raises(ValidationError):
        EvidenceAttachRequest.model_validate({**request.model_dump(), extra: "injected"})


def test_multiple_same_category_sources_have_distinct_attachment_identities():
    case, source, request = records()
    one = prepare_attachment(case, source, request, "attachment-a", "staff-a")
    other_source = source.model_copy(update={"source_version_id": "source-v2"})
    other_request = request.model_copy(
        update={"source_version_id": "source-v2", "idempotency_key": "request-b"}
    )
    two = prepare_attachment(case, other_source, other_request, "attachment-b", "staff-a")
    assert one.attachment_id != two.attachment_id
    assert one.source_version_id != two.source_version_id


@pytest.mark.parametrize("category", ["payer_policy", "guideline", "research"])
def test_context_sources_are_distinct_from_patient_facts(category):
    case, source, request = records()
    context = SourceVersion.model_validate(
        {
            **source.model_dump(),
            "category": category,
            "patient_ref": None,
        }
    )
    attachment = prepare_attachment(case, context, request, "attachment-a", "staff-a")
    assert attachment.role == "context"
    with pytest.raises(ValueError, match="context_source_has_patient"):
        prepare_attachment(
            case,
            context.model_copy(update={"patient_ref": "PT-A"}),
            request,
            "attachment-b",
            "staff-a",
        )


def test_staff_interpretation_is_not_a_source_category():
    _, source, _ = records()
    with pytest.raises(ValidationError):
        SourceVersion.model_validate({**source.model_dump(), "category": "staff_interpretation"})


@pytest.mark.parametrize("span", [{"start": 8, "end": 8}, {"start": 11, "end": 8}])
def test_request_and_rehydrated_attachment_reject_invalid_span(span):
    from models.schemas import EvidenceAttachment

    case, source, request = records()
    attachment = prepare_attachment(case, source, request, "attachment-a", "staff-a")
    for model, value in ((EvidenceAttachRequest, request), (EvidenceAttachment, attachment)):
        with pytest.raises(ValidationError):
            model.model_validate({**value.model_dump(), **span})


def test_rejections_have_typed_codes():
    from cases.errors import EvidenceRejected

    case, source, request = records()
    with pytest.raises(EvidenceRejected) as error:
        prepare_attachment(
            case, source, request.model_copy(update={"expected_case_revision": 2}), "a", "staff-a"
        )
    assert error.value.code == "stale_case_revision"


def test_invalid_unicode_is_rejected_at_schema_boundary():
    _, source, request = records()
    for model, values, field in (
        (SourceVersion, source.model_dump(), "body"),
        (EvidenceAttachRequest, request.model_dump(), "excerpt"),
    ):
        with pytest.raises(ValidationError):
            model.model_validate({**values, field: "\ud800"})


def test_excerpt_length_matches_span_in_both_contracts():
    from models.schemas import EvidenceAttachment

    case, source, request = records()
    attachment = prepare_attachment(case, source, request, "attachment-a", "staff-a")
    for model, value in ((EvidenceAttachRequest, request), (EvidenceAttachment, attachment)):
        with pytest.raises(ValidationError):
            model.model_validate({**value.model_dump(), "end": 12})


@pytest.mark.parametrize("category,patient", [("patient_record", None), ("payer_policy", "PT-A")])
def test_source_category_and_patient_association_are_validated(category, patient):
    _, source, _ = records()
    with pytest.raises(ValidationError):
        SourceVersion.model_validate(
            {**source.model_dump(), "category": category, "patient_ref": patient}
        )
