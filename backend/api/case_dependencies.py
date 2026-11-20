"""HTTP adaptation for case authentication and sanitized transaction errors."""

from contextlib import contextmanager

from fastapi import HTTPException, Request
from pydantic import ValidationError

from cases.store_errors import CaseConflict, CaseStoreError
from models.schemas import CaseIdentity
from storage.case_authorization import CaseAccessDenied
from storage.case_service import CaseService
from storage.config import DatabaseConfigurationError


def case_service(request: Request) -> CaseService:
    # Only middleware-resolved session claims. Bearer never sets a subject.
    subject = getattr(request.state, "session_user_id", "")
    scope = getattr(request.state, "tenancy_scope", None)
    if not subject or scope is None or scope.is_platform:
        raise HTTPException(401, "Session required")
    try:
        identity = CaseIdentity(tenant_id=scope.tenant_id, subject_id=subject)
    except ValidationError:
        raise HTTPException(401, "Session required") from None
    config = getattr(request.app.state, "database_config", None)
    if config is None:
        raise HTTPException(503, "case_service_unavailable")
    return CaseService(config, identity)


@contextmanager
def case_errors():
    try:
        yield
    except CaseAccessDenied:
        raise HTTPException(404, "case_not_found") from None
    except CaseConflict:
        raise HTTPException(409, "case_conflict") from None
    except (CaseStoreError, DatabaseConfigurationError):
        raise HTTPException(503, "case_service_unavailable") from None
