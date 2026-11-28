"""Scoped case I/O. Caller owns outer transaction; commit before reporting success."""

import json
from collections.abc import Callable
from uuid import UUID, uuid4

import psycopg
from psycopg.pq import TransactionStatus
from psycopg.rows import dict_row
from pydantic import TypeAdapter, ValidationError

from cases.store_errors import CaseConflict, CaseStoreError
from cases.store_rules import validate_create_replay
from models.schemas import (
    CaseAccess,
    CaseCreateRequest,
    CaseEventRecord,
    CaseRecord,
    PersistentCaseId,
)

_CASE_COLUMNS = "tenant_id, case_id::text AS case_id, patient_ref, revision"
_CASE_ID = TypeAdapter(PersistentCaseId)
_REPLAY = """
SELECT e.tenant_id, e.case_id::text AS case_id, c.patient_ref, e.case_revision AS revision
FROM clearauth_case_events e
JOIN clearauth_cases c ON c.tenant_id = e.tenant_id AND c.case_id = e.case_id
WHERE e.tenant_id = %s AND e.actor_id = %s
  AND e.action = 'case_created' AND e.idempotency_key = %s
"""
_EVENTS = """
SELECT e.event_id, e.event_sequence, e.tenant_id, e.case_id::text AS case_id, e.actor_id, e.action,
       e.case_revision, e.idempotency_key, e.occurred_at
FROM clearauth_case_events e
JOIN clearauth_cases c ON c.tenant_id = e.tenant_id AND c.case_id = e.case_id
WHERE c.tenant_id = %s AND c.patient_ref = %s AND c.case_id = %s
ORDER BY e.event_sequence
"""


class CaseRepository:
    def __init__(self, connection: psycopg.Connection, *, new_case_id: Callable[[], UUID] = uuid4):
        self.connection = connection
        self._new_case_id = new_case_id

    def create_case(self, scope: CaseAccess, command: CaseCreateRequest) -> CaseRecord:
        """Stage case+event atomically; identical retries replay the original version."""
        try:
            scope = CaseAccess.model_validate(scope.model_dump())
            command = CaseCreateRequest.model_validate(command.model_dump())
        except ValidationError:
            raise CaseStoreError("case_input_invalid") from None
        if self.connection.info.transaction_status != TransactionStatus.INTRANS:
            raise CaseStoreError("outer_transaction_required")
        try:
            with self.connection.transaction(), self.connection.cursor(row_factory=dict_row) as cur:
                key = json.dumps(
                    ["case-create", scope.tenant_id, scope.actor_id, command.idempotency_key]
                )
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (key,))
                cur.execute(_REPLAY, (scope.tenant_id, scope.actor_id, command.idempotency_key))
                replay = cur.fetchone()
                if replay is not None:
                    return validate_create_replay(CaseRecord.model_validate(replay), scope)
                case_id = self._new_case_id()
                record = self._insert_case(cur, scope, case_id)
                self._insert_event(cur, scope, command, case_id)
                return record
        except psycopg.Error:
            raise CaseStoreError("case_write_failed") from None
        except ValidationError:
            raise CaseStoreError("stored_case_invalid") from None

    @staticmethod
    def _insert_case(cur, scope: CaseAccess, case_id) -> CaseRecord:
        cur.execute(
            "INSERT INTO clearauth_cases (tenant_id, case_id, patient_ref) VALUES (%s, %s, %s) "
            "ON CONFLICT (tenant_id, case_id) DO NOTHING RETURNING " + _CASE_COLUMNS,
            (scope.tenant_id, case_id, scope.patient_ref),
        )
        row = cur.fetchone()
        if row is None:
            raise CaseConflict("case_already_exists")
        return CaseRecord.model_validate(row)

    @staticmethod
    def _insert_event(cur, scope: CaseAccess, command: CaseCreateRequest, case_id) -> None:
        cur.execute(
            "INSERT INTO clearauth_case_events "
            "(event_id, tenant_id, case_id, actor_id, action, case_revision, idempotency_key) "
            "VALUES (%s, %s, %s, %s, 'case_created', 1, %s)",
            (
                str(uuid4()),
                scope.tenant_id,
                case_id,
                scope.actor_id,
                command.idempotency_key,
            ),
        )

    def read_case(self, scope: CaseAccess, case_id: str) -> CaseRecord | None:
        scope, case_id = _validated_read(scope, case_id)
        try:
            with self.connection.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT " + _CASE_COLUMNS + " FROM clearauth_cases "
                    "WHERE tenant_id = %s AND patient_ref = %s AND case_id = %s",
                    (scope.tenant_id, scope.patient_ref, case_id),
                )
                row = cur.fetchone()
                return None if row is None else CaseRecord.model_validate(row)
        except psycopg.Error:
            raise CaseStoreError("case_read_failed") from None
        except ValidationError:
            raise CaseStoreError("stored_case_invalid") from None

    def events_for_case(self, scope: CaseAccess, case_id: str) -> tuple[CaseEventRecord, ...]:
        scope, case_id = _validated_read(scope, case_id)
        try:
            with self.connection.cursor(row_factory=dict_row) as cur:
                cur.execute(_EVENTS, (scope.tenant_id, scope.patient_ref, case_id))
                return tuple(CaseEventRecord.model_validate(row) for row in cur.fetchall())
        except psycopg.Error:
            raise CaseStoreError("case_read_failed") from None
        except ValidationError:
            raise CaseStoreError("stored_case_invalid") from None


def _validated_read(scope: CaseAccess, case_id: str) -> tuple[CaseAccess, str]:
    try:
        return CaseAccess.model_validate(scope.model_dump()), _CASE_ID.validate_python(
            case_id, strict=True
        )
    except ValidationError:
        raise CaseStoreError("case_input_invalid") from None
