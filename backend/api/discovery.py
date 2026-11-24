"""Case-scoped offline search and attachment endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from api.assessment import assessment_reader
from api.case_dependencies import case_errors, case_service
from cases.assessment_sources import SourceReader
from cases.discovery import PediatricDiscovery
from cases.store_errors import CaseConflict
from models.discovery import (
    AttachmentRequest,
    AttachResult,
    CaseAttachment,
    DiscoveryConflict,
    DiscoveryNotFound,
    DiscoveryQuerySummary,
    DiscoveryResults,
    DiscoverySearch,
    DiscoveryUnavailable,
)
from models.schemas import PatientRef, PersistentCaseId
from storage.case_service import CaseService
from storage.discovery_commands import change_attachment


class DiscoveryRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def handle(request: Request) -> Response:
            with case_errors():
                try:
                    return await handler(request)
                except CaseConflict as exc:
                    return JSONResponse(
                        {"detail": "case_conflict", "code": exc.code}, status_code=409
                    )

        return handle


router = APIRouter(
    prefix="/api/patients/{patient_ref}/cases/{case_id}",
    tags=["discovery"],
    route_class=DiscoveryRoute,
    responses={
        404: {"model": DiscoveryNotFound},
        409: {"model": DiscoveryConflict},
        503: {"model": DiscoveryUnavailable},
    },
)
Service = Annotated[CaseService, Depends(case_service)]


@router.post("/discovery")
def search_sources(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    body: DiscoverySearch,
    service: Service,
    reader: Annotated[SourceReader, Depends(assessment_reader)],
) -> DiscoveryResults:
    with service.discovery(patient_ref, case_id, write=True) as store:
        return store.search(body, PediatricDiscovery(reader))


@router.get("/discovery")
def list_queries(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=50)] = 50,
) -> tuple[DiscoveryQuerySummary, ...]:
    with service.discovery(patient_ref, case_id) as store:
        return store.queries(limit)


@router.get("/discovery/{query_id}")
def read_results(
    patient_ref: PatientRef, case_id: PersistentCaseId, query_id: PersistentCaseId, service: Service
) -> DiscoveryResults:
    with service.discovery(patient_ref, case_id) as store:
        return store.results(query_id)


@router.post("/attachments")
def attach_result(
    patient_ref: PatientRef, case_id: PersistentCaseId, body: AttachResult, service: Service
) -> CaseAttachment:
    with service.discovery(patient_ref, case_id, write=True) as store:
        return change_attachment(store, body, "attach", body.result_id)


@router.delete("/attachments/{attachment_id}")
def remove_attachment(
    patient_ref: PatientRef,
    case_id: PersistentCaseId,
    attachment_id: PersistentCaseId,
    body: AttachmentRequest,
    service: Service,
) -> CaseAttachment:
    with service.discovery(patient_ref, case_id, write=True) as store:
        return change_attachment(store, body, "remove", attachment_id)


@router.get("/attachments")
def list_attachments(
    patient_ref: PatientRef, case_id: PersistentCaseId, service: Service
) -> tuple[CaseAttachment, ...]:
    with service.discovery(patient_ref, case_id) as store:
        return store.attachments()
