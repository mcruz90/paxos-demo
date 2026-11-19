"""Persistent-case command boundaries use only neutral synthetic identities."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from cases.store_errors import CaseConflict, CaseStoreError
from cases.store_rules import validate_create_replay
from models.schemas import CaseAccess, CaseCreateRequest, CaseEventRecord, CaseRecord


@pytest.mark.parametrize(
    "injected", ["case_id", "tenant_id", "patient_ref", "actor_id", "revision"]
)
def test_create_command_rejects_client_supplied_scope_or_revision(injected):
    with pytest.raises(ValidationError):
        CaseCreateRequest.model_validate(
            {
                "idempotency_key": "request-x",
                injected: "untrusted",
            }
        )


def test_access_grant_is_explicit_and_immutable():
    with pytest.raises(ValidationError):
        CaseAccess.model_validate({"tenant_id": "tenant-x", "actor_id": "staff-x"})
    grant = CaseAccess(tenant_id="tenant-x", patient_ref="PAT-X", actor_id="staff-x")
    with pytest.raises(ValidationError):
        grant.patient_ref = "PAT-Y"


def test_storage_errors_have_metadata_only_codes():
    assert CaseConflict("idempotency_conflict").code == "idempotency_conflict"
    assert str(CaseStoreError("case_write_failed")) == "case_write_failed"


@pytest.mark.parametrize(
    "change",
    [
        {"tenant_id": "tenant-y"},
        {"patient_ref": "PAT-Y"},
    ],
)
def test_replay_rejects_a_different_logical_request(change):
    original = CaseRecord(tenant_id="tenant-x", case_id="case-x", patient_ref="PAT-X", revision=1)
    scope = CaseAccess.model_validate(
        {"tenant_id": "tenant-x", "patient_ref": "PAT-X", "actor_id": "staff-x"}
        | {key: value for key, value in change.items() if key != "case_id"}
    )
    with pytest.raises(CaseConflict, match="idempotency_conflict"):
        validate_create_replay(original, scope)


def test_exact_replay_preserves_the_original_record():
    original = CaseRecord(tenant_id="tenant-x", case_id="case-x", patient_ref="PAT-X", revision=1)
    scope = CaseAccess(tenant_id="tenant-x", patient_ref="PAT-X", actor_id="staff-x")
    assert validate_create_replay(original, scope) is original


def test_creation_event_cannot_claim_a_later_revision():
    with pytest.raises(ValidationError):
        CaseEventRecord.model_validate(
            {
                "event_id": "event-x",
                "event_sequence": 1,
                "tenant_id": "tenant-x",
                "case_id": "case-x",
                "actor_id": "staff-x",
                "action": "case_created",
                "case_revision": 2,
                "idempotency_key": "request-x",
                "occurred_at": datetime(2026, 1, 1, tzinfo=UTC),
            }
        )
