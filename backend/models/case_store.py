"""Persistent case commands and trusted access grants; no HTTP grant factory yet."""

from typing import Annotated, Literal

from pydantic import AwareDatetime, Field

from models.case_evidence import FrozenRecord, RecordId
from models.requests import PatientRef, TenantId

PersistentCaseId = Annotated[
    str,
    Field(
        min_length=36,
        max_length=36,
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    ),
]


class CaseAccess(FrozenRecord):
    """Server-resolved authorization for one patient; never accept from a body."""

    tenant_id: TenantId
    patient_ref: PatientRef
    actor_id: RecordId


class CaseCreateRequest(FrozenRecord):
    idempotency_key: RecordId


class CaseEventRecord(FrozenRecord):
    event_id: RecordId
    event_sequence: Annotated[int, Field(ge=1, le=9223372036854775807)]
    tenant_id: TenantId
    case_id: RecordId
    actor_id: RecordId
    action: Literal["case_created"]
    case_revision: Literal[1]
    idempotency_key: RecordId
    occurred_at: AwareDatetime
