"""Case-scoped offline search and attachment endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends

from api.assessment import assessment_reader
from api.case_dependencies import case_errors, case_service
from cases.assessment_sources import SourceReader
from cases.discovery import PediatricDiscovery
from models.discovery import (
    AttachmentRequest,
    AttachResult,
    CaseAttachment,
    DiscoveryResults,
    DiscoverySearch,
)
from models.schemas import PatientRef, PersistentCaseId
from storage.case_service import CaseService
from storage.discovery_commands import change_attachment

router = APIRouter(prefix="/api/patients/{patient_ref}/cases/{case_id}", tags=["discovery"])
Service = Annotated[CaseService, Depends(case_service)]


@router.post("/discovery")
def search_sources(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    body: DiscoverySearch,
    service: Service,
    reader: Annotated[SourceReader, Depends(assessment_reader)],
) -> DiscoveryResults:
    with case_errors(), service.discovery(patient_ref, case_id, write=True) as store:
        return store.search(body, PediatricDiscovery(reader))


@router.get("/discovery/{query_id}")
def read_results(
    patient_ref: PatientRef, case_id: PersistentCaseId, query_id: PersistentCaseId, service: Service
) -> DiscoveryResults:
    with case_errors(), service.discovery(patient_ref, case_id) as store:
        return store.results(query_id)


@router.post("/attachments")
def attach_result(
    patient_ref: PatientRef, case_id: PersistentCaseId, body: AttachResult, service: Service
) -> CaseAttachment:
    with case_errors(), service.discovery(patient_ref, case_id, write=True) as store:
        return change_attachment(store, body, "attach", body.result_id)


@router.delete("/attachments/{attachment_id}")
def remove_attachment(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    attachment_id: PersistentCaseId,
    body: AttachmentRequest,
    service: Service,
) -> CaseAttachment:
    with case_errors(), service.discovery(patient_ref, case_id, write=True) as store:
        return change_attachment(store, body, "remove", attachment_id)


@router.get("/attachments")
def list_attachments(
    patient_ref: PatientRef, case_id: PersistentCaseId, service: Service
) -> tuple[CaseAttachment, ...]:
    with case_errors(), service.discovery(patient_ref, case_id) as store:
        return store.attachments()
