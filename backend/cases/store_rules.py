"""Pure rules for replaying an earlier case-creation request."""

from cases.store_errors import CaseConflict
from models.schemas import CaseAccess, CaseRecord


def validate_create_replay(original: CaseRecord, scope: CaseAccess) -> CaseRecord:
    if original.tenant_id != scope.tenant_id or original.patient_ref != scope.patient_ref:
        raise CaseConflict("idempotency_conflict")
    return original
