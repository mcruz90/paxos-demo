"""Trusted synthetic source port for explicitly bound demo case revisions."""

from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from typing import Protocol

from cases.dose_fixture import DoseDocuments, dose_documents
from cases.duration_approval import DurationDecision, pediatric_duration_decision
from golden_set.identities import get_identity
from models.case_evidence import CaseRecord, SourceVersion
from models.tenancy import SEEDED_TENANT_ID


@dataclass(frozen=True)
class AssessmentInputs:
    sources: tuple[SourceVersion, ...]
    plan_id: str
    drug: str
    diagnosis: str
    dob: date | None
    service_date: date | None
    policy_date: date | None
    duration_decision: DurationDecision | None = None
    dose_documents: DoseDocuments | None = None


class SourceReader(Protocol):
    def read(self, case: CaseRecord) -> AssessmentInputs | None: ...


@dataclass(frozen=True)
class PediatricFixtureReader:
    # A demo bootstrapper may bind its server-created case UUID explicitly.
    case_id: str | None = None
    tenant_id: str = SEEDED_TENANT_ID
    patient_ref: str = "PT-4201"
    dose_case_id: str | None = None

    def read(self, case: CaseRecord) -> AssessmentInputs | None:
        scope = case.case_id, case.tenant_id, case.patient_ref, case.revision
        if scope == (self.dose_case_id, self.tenant_id, "PT-4202", 1):
            return _dose_inputs(case)
        if scope != (self.case_id, self.tenant_id, self.patient_ref, 1):
            return None
        records = {
            "gi-2026-10-21-v1": "Age at request: 7 years.\nDiagnosis: K21.0.",
            "slp-2026-10-07-v1": "Unable to swallow whole tablets or capsules due to dysphagia.",
        }
        sources = _sources(case, records)
        identity = get_identity("esomeprazole_uhc_pediatric")
        claim_date = date(2026, 10, 23)
        return AssessmentInputs(
            sources,
            "UHC-CHOICE-2026",
            "Nexium oral suspension",
            "K21.0",
            date.fromisoformat(identity.patient_dob),
            claim_date,
            claim_date,
            pediatric_duration_decision(),
        )


def _sources(case: CaseRecord, records: dict[str, str]) -> tuple[SourceVersion, ...]:
    return tuple(
        SourceVersion(
            source_version_id=key,
            origin_ref=key,
            case_id=case.case_id,
            tenant_id=case.tenant_id,
            patient_ref=case.patient_ref,
            category="patient_record",
            body=body,
            body_sha256=sha256(body.encode()).hexdigest(),
        )
        for key, body in records.items()
    )


def _dose_inputs(case: CaseRecord) -> AssessmentInputs:
    claim = date(2026, 10, 23)
    records = {
        "synthetic-dose-chart-v1": "Age at request: 7 years.\nDiagnosis: K21.0.\nWeight: 23 kg."
    }
    return AssessmentInputs(
        _sources(case, records),
        "UHC-CHOICE-2026",
        "Nexium oral suspension",
        "K21.0",
        date(2019, 1, 15),
        claim,
        claim,
        dose_documents=dose_documents(),
    )
