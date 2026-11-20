"""Strict case-local evidence contracts; re-exported via models.schemas."""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.requests import PatientRef, TenantId

RecordId = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")]
Digest = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
Revision = Annotated[int, Field(ge=1)]


class FrozenRecord(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)


class CaseRecord(FrozenRecord):
    case_id: RecordId
    tenant_id: TenantId
    patient_ref: PatientRef
    revision: Revision


class SourceVersion(FrozenRecord):
    source_version_id: RecordId
    case_id: RecordId
    tenant_id: TenantId
    category: Literal["patient_record", "payer_policy", "guideline", "research"]
    patient_ref: PatientRef | None = None
    body: Annotated[str, Field(min_length=1, max_length=100000)]
    body_sha256: Digest
    origin_ref: Annotated[str, Field(min_length=1, max_length=500)]

    @model_validator(mode="after")
    def patient_association(self) -> Self:
        if (self.category == "patient_record") != (self.patient_ref is not None):
            raise ValueError("source_category_patient_mismatch")
        return self


class ExcerptSpan(FrozenRecord):
    start: Annotated[int, Field(ge=0, description="Inclusive Unicode code-point offset")]
    end: Annotated[int, Field(ge=1, description="Exclusive Unicode code-point offset")]
    excerpt: Annotated[str, Field(min_length=1, max_length=20000)]

    @model_validator(mode="after")
    def nonempty_span(self) -> Self:
        if self.start >= self.end:
            raise ValueError("invalid_excerpt_span")
        if self.end - self.start != len(self.excerpt):
            raise ValueError("excerpt_length_mismatch")
        return self


class EvidenceAttachRequest(ExcerptSpan):
    source_version_id: RecordId
    expected_case_revision: Revision
    idempotency_key: RecordId
    role: Literal["support", "contradict", "context"]
    criterion_ref: RecordId | None = None


class EvidenceAttachment(ExcerptSpan):
    attachment_id: RecordId
    case_id: RecordId
    tenant_id: TenantId
    case_revision: Revision
    source_version_id: RecordId
    source_sha256: Digest
    excerpt_sha256: Digest
    role: Literal["support", "contradict", "context"]
    criterion_ref: RecordId | None = None
    actor_id: RecordId
    idempotency_key: RecordId
