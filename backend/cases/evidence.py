"""Pure attachment preparation; persistence and clinical reassessment are separate."""

from hashlib import sha256

from cases.errors import EvidenceRejected
from models.schemas import CaseRecord, EvidenceAttachment, EvidenceAttachRequest, SourceVersion


def prepare_attachment(
    case: CaseRecord,
    source: SourceVersion,
    request: EvidenceAttachRequest,
    attachment_id: str,
    actor_id: str,
) -> EvidenceAttachment:
    """Bind an exact excerpt to a case; never resolve a finding as a side effect."""
    if source.tenant_id != case.tenant_id or source.case_id != case.case_id:
        raise EvidenceRejected("source_scope_mismatch")
    if source.category == "patient_record":
        if source.patient_ref != case.patient_ref:
            raise EvidenceRejected("source_patient_mismatch")
    elif source.patient_ref is not None:
        raise EvidenceRejected("context_source_has_patient")
    if source.source_version_id != request.source_version_id:
        raise EvidenceRejected("source_version_mismatch")
    if case.revision != request.expected_case_revision:
        raise EvidenceRejected("stale_case_revision")
    if sha256(source.body.encode("utf-8")).hexdigest() != source.body_sha256:
        raise EvidenceRejected("source_digest_mismatch")
    if not 0 <= request.start < request.end <= len(source.body):
        raise EvidenceRejected("invalid_excerpt_span")
    if source.body[request.start : request.end] != request.excerpt:
        raise EvidenceRejected("excerpt_mismatch")
    return EvidenceAttachment(
        attachment_id=attachment_id,
        case_id=case.case_id,
        tenant_id=case.tenant_id,
        case_revision=case.revision,
        source_version_id=source.source_version_id,
        source_sha256=source.body_sha256,
        excerpt_sha256=sha256(request.excerpt.encode("utf-8")).hexdigest(),
        start=request.start,
        end=request.end,
        excerpt=request.excerpt,
        role=request.role,
        criterion_ref=request.criterion_ref,
        actor_id=actor_id,
        idempotency_key=request.idempotency_key,
    )
