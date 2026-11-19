"""Resolve and hold a durable panel grant for the caller's transaction (ADR-0017)."""

import psycopg
from psycopg.pq import TransactionStatus
from pydantic import TypeAdapter, ValidationError

from cases.store_errors import CaseStoreError
from models.schemas import CaseAccess, CaseIdentity, PatientRef

_PATIENT = TypeAdapter(PatientRef)
_GRANT = """
SELECT p.actor_id
FROM clearauth_case_principals p
JOIN clearauth_panel_members m
  ON m.tenant_id = p.tenant_id AND m.actor_id = p.actor_id
JOIN clearauth_panel_patients a
  ON a.tenant_id = m.tenant_id AND a.group_id = m.group_id
WHERE p.tenant_id = %s AND p.subject_id = %s AND p.active
  AND p.role IN ('coordinator', 'clinician', 'admin') AND a.patient_ref = %s
ORDER BY m.group_id
LIMIT 1
FOR SHARE OF p, m, a
"""


class CaseAccessDenied(RuntimeError):
    """Same public result for absent grants, patients and cases."""

    def __init__(self):
        super().__init__("case_not_found")


def resolve_case_access(
    connection: psycopg.Connection, identity: CaseIdentity, patient_ref: str
) -> CaseAccess:
    """No wildcard, implicit grant, role bypass, or caller-selected actor.

    Shared row locks keep an admitted operation ordered before any concurrent
    revocation. A subsequent transaction reloads grants and observes revocation.
    The caller holds this transaction through case I/O and outer commit.
    """
    try:
        identity = CaseIdentity.model_validate(identity.model_dump())
        patient_ref = _PATIENT.validate_python(patient_ref, strict=True)
    except ValidationError:
        raise CaseAccessDenied() from None
    if connection.info.transaction_status != TransactionStatus.INTRANS:
        raise CaseStoreError("outer_transaction_required")
    try:
        row = connection.execute(
            _GRANT, (identity.tenant_id, identity.subject_id, patient_ref)
        ).fetchone()
        if row is None:
            raise CaseAccessDenied()
        return CaseAccess(tenant_id=identity.tenant_id, actor_id=row[0], patient_ref=patient_ref)
    except psycopg.Error:
        raise CaseStoreError("case_read_failed") from None
    except ValidationError:
        raise CaseStoreError("stored_case_invalid") from None
