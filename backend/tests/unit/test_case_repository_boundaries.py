"""I/O-boundary guards, not simulated SQL or database business-rule tests."""

from types import SimpleNamespace

import pytest
from psycopg.pq import TransactionStatus

from cases.store_errors import CaseStoreError
from models.schemas import CaseAccess, CaseCreateRequest
from storage.case_repository import CaseRepository

GRANT = CaseAccess(tenant_id="tenant-x", patient_ref="PAT-X", actor_id="staff-x")
COMMAND = CaseCreateRequest(idempotency_key="request-x")


@pytest.mark.parametrize(
    "status",
    [
        TransactionStatus.IDLE,
        TransactionStatus.INERROR,
        TransactionStatus.ACTIVE,
        TransactionStatus.UNKNOWN,
    ],
)
def test_create_rejects_missing_or_unusable_outer_transaction_before_io(status):
    # No SQL/transaction methods: guard must fail before attempting either.
    conn = SimpleNamespace(info=SimpleNamespace(transaction_status=status))
    with pytest.raises(CaseStoreError, match="^outer_transaction_required$"):
        CaseRepository(conn).create_case(GRANT, COMMAND)


@pytest.mark.parametrize("method", ["read_case", "events_for_case"])
@pytest.mark.parametrize("case_id", ["", "x" * 129, "invalid id", 12])
def test_reads_validate_bounded_case_id_before_io(method, case_id):
    repo = CaseRepository(SimpleNamespace())
    with pytest.raises(CaseStoreError, match="^case_input_invalid$"):
        getattr(repo, method)(GRANT, case_id)


def test_invalid_internal_create_input_has_a_distinct_error_before_io():
    conn = SimpleNamespace(info=SimpleNamespace(transaction_status=TransactionStatus.INTRANS))
    command = CaseCreateRequest.model_construct(idempotency_key="invalid key")
    with pytest.raises(CaseStoreError, match="^case_input_invalid$"):
        CaseRepository(conn).create_case(GRANT, command)
