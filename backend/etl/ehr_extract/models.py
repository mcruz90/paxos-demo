"""Immutable data contracts for deterministic EHR evidence distillation."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date
from typing import Literal, Protocol

from cases.assessment_records import Citation

ThresholdOperator = Literal["<", "<=", ">", ">=", "ULN"]
ThresholdRelation = Literal["above", "below", "at", "unknown"]
SpecialistRole = Literal["prescriber", "signer", "consultant", "attestation"]


class CitedRecord(Protocol):
    @property
    def citation(self) -> Citation: ...


@dataclass(frozen=True)
class StepTherapyTrial:
    """Extracted step-therapy trial with inclusive duration_days ((end - start).days + 1)."""

    drug: str
    start_date: date | None
    end_date: date | None
    duration_days: int | None
    outcome: str
    reason: str | None
    citation: Citation


@dataclass(frozen=True)
class LabMeasurement:
    analyte: str
    value: float
    unit: str
    threshold_operator: ThresholdOperator | None
    threshold_value: float | None
    threshold_unit: str | None
    threshold_relation: ThresholdRelation
    observed_date: date | None
    citation: Citation


@dataclass(frozen=True)
class SpecialistMarker:
    role_kind: SpecialistRole
    clinician: str
    specialty: str
    signed_date: date | None
    citation: Citation


@dataclass(frozen=True)
class DiagnosisEvidence:
    icd10_codes: tuple[str, ...]
    description: str
    confirmed_date: date | None
    citation: Citation


@dataclass(frozen=True)
class ClinicalObservation:
    criterion_key: str
    value: str
    citation: Citation


@dataclass(frozen=True)
class ReviewFlag:
    reason: str
    detail: str
    citation: Citation


@dataclass(frozen=True)
class SourceMetadata:
    source_version_id: str
    origin_ref: str
    category: Literal["patient_record", "payer_policy", "guideline", "research"]
    patient_ref: str | None


@dataclass(frozen=True)
class SourceSummary:
    source_version_id: str
    matched_count: int
    review_flag_count: int
    retained: bool


@dataclass(frozen=True)
class ChartEvidenceDigest:
    case_id: str
    tenant_id: str
    patient_ref: str
    source_count: int
    retained_source_count: int
    step_therapy: tuple[StepTherapyTrial, ...]
    labs: tuple[LabMeasurement, ...]
    specialists: tuple[SpecialistMarker, ...]
    diagnoses: tuple[DiagnosisEvidence, ...]
    observations: tuple[ClinicalObservation, ...]
    review_flags: tuple[ReviewFlag, ...]
    source_summaries: tuple[SourceSummary, ...]
    source_metadata: tuple[SourceMetadata, ...]

    @property
    def needs_human_review(self) -> bool:
        return bool(self.review_flags)

    def all_citations(self) -> tuple[Citation, ...]:
        """Return every cited span across structured matches and review flags."""
        return tuple(self._iter_citations())

    def _iter_citations(self) -> Iterator[Citation]:
        groups: tuple[tuple[CitedRecord, ...], ...] = (
            self.step_therapy,
            self.labs,
            self.specialists,
            self.diagnoses,
            self.observations,
            self.review_flags,
        )
        for group in groups:
            for item in group:
                yield item.citation
