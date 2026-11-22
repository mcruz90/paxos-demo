"""Patient-scoped metadata routes; no evidence, clinical decisions, or artifacts."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.assessment import CaseAssessment, assessment_reader, public_assessment
from api.case_dependencies import case_errors, case_service
from cases.assessment_sources import SourceReader
from models.schemas import (
    CaseCreateRequest,
    CaseEventRecord,
    CaseRecord,
    PatientRef,
    PersistentCaseId,
)
from storage.case_service import CaseService

router = APIRouter(prefix="/api/patients/{patient_ref}/cases", tags=["cases"])
Service = Annotated[CaseService, Depends(case_service)]


@router.post("")
def create_case(patient_ref: PatientRef, body: CaseCreateRequest, service: Service) -> CaseRecord:
    with case_errors():
        return service.create(patient_ref, body)


@router.get("/{case_id}")
def read_case(patient_ref: PatientRef, case_id: PersistentCaseId, service: Service) -> CaseRecord:
    with case_errors():
        return service.read(patient_ref, case_id)


@router.get("/{case_id}/events")
def read_case_events(
    patient_ref: PatientRef, case_id: PersistentCaseId, service: Service
) -> tuple[CaseEventRecord, ...]:
    with case_errors():
        return service.events(patient_ref, case_id)


@router.get("/{case_id}/assessment")
def read_case_assessment(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    service: Service,
    reader: Annotated[SourceReader, Depends(assessment_reader)],
) -> CaseAssessment:
    with case_errors():
        case = service.read(patient_ref, case_id)
        return public_assessment(case, reader)
