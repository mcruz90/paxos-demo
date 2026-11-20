"""Invalid or untrusted identity inputs must not reach SQL."""

from types import SimpleNamespace

import pytest
from psycopg.pq import TransactionStatus

from cases.store_errors import CaseStoreError
from models.schemas import CaseIdentity
from storage.case_authorization import CaseAccessDenied, resolve_case_access


@pytest.mark.parametrize("patient", ["", "bad patient", "x" * 65, 12])
def test_invalid_patient_is_rejected_before_io(patient):
    identity = CaseIdentity(tenant_id="tenant-x", subject_id="staff-x")
    with pytest.raises(CaseAccessDenied):
        resolve_case_access(SimpleNamespace(), identity, patient)


def test_invalid_internal_identity_is_revalidated_before_io():
    identity = CaseIdentity.model_construct(tenant_id="invalid tenant", subject_id="staff-x")
    with pytest.raises(CaseAccessDenied):
        resolve_case_access(SimpleNamespace(), identity, "PAT-X")


@pytest.mark.parametrize(
    "status",
    [
        TransactionStatus.IDLE,
        TransactionStatus.INERROR,
        TransactionStatus.ACTIVE,
        TransactionStatus.UNKNOWN,
    ],
)
def test_grant_requires_outer_transaction_to_hold_revocation_locks(status):
    conn = SimpleNamespace(info=SimpleNamespace(transaction_status=status))
    identity = CaseIdentity(tenant_id="tenant-x", subject_id="staff-x")
    with pytest.raises(CaseStoreError, match="^outer_transaction_required$"):
        resolve_case_access(conn, identity, "PAT-X")
