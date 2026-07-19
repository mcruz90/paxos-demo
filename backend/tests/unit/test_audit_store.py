"""Unit tests — audit/store.py (S2 Slice 4).

Pre-DB audit log: in-memory list[AuditRecord] surviving the request
lifecycle, reset only on server restart (CLAUDE.md ACID §Durability). Writes
are idempotent on idempotency_key — a retried request must never double-write
an audit entry.
"""

from __future__ import annotations

import pytest

from audit.store import all_records, reset_audit_log, write_audit_record
from models.schemas import AuditProvenance, AuditRecord, CaseLifecycle
from security.tenancy import TenancyScope


@pytest.fixture(autouse=True)
def _clean_audit_log():
    reset_audit_log()
    yield
    reset_audit_log()


def _record(idempotency_key: str = "PA-2026-0847:a1") -> AuditRecord:
    return AuditRecord(
        correlation_id=idempotency_key,
        idempotency_key=idempotency_key,
        lifecycle=CaseLifecycle.appeal,
        scenario_id="ozempic-cigna-clinical-pa",
        drug="Ozempic (semaglutide)",
        plan="Cigna Connect 500 PPO",
        denial_reason="step therapy",
        timestamp="2026-07-03T00:00:00+00:00",
        duration_ms=42,
        model_name="mock-llm",
        artifact_ref="a1b2c3d4e5f6",
        outcome="done",
        gatekeeper_passed=True,
        retry_count=0,
        pa_resolution="plan_id",
        provenance=AuditProvenance.as_is,
    )


def test_write_appends_record() -> None:
    assert write_audit_record(_record()) is True
    assert len(all_records(TenancyScope.platform())) == 1


def test_write_dedupes_on_idempotency_key() -> None:
    """Second write with the same idempotency key is a no-op — the retried
    request maps onto the existing entry, never a duplicate."""
    assert write_audit_record(_record()) is True
    assert write_audit_record(_record()) is False
    assert len(all_records(TenancyScope.platform())) == 1


def test_distinct_attempts_write_distinct_records() -> None:
    write_audit_record(_record("PA-2026-0847:a1"))
    write_audit_record(_record("PA-2026-0847:a2"))
    assert len(all_records(TenancyScope.platform())) == 2


def test_all_records_returns_copy() -> None:
    write_audit_record(_record())
    snapshot = all_records(TenancyScope.platform())
    snapshot.clear()
    assert len(all_records(TenancyScope.platform())) == 1


def test_provenance_enum_values() -> None:
    """AI-accountability provenance vocabulary (CLAUDE.md §AI Output
    Accountability): model output as-is, gatekeeper-corrected, human-edited,
    or human-approved unchanged (ADR-0009 amendment 2026-07-18)."""
    assert {member.value for member in AuditProvenance} == {
        "as_is",
        "gatekeeper_corrected",
        "human_edited",
        "human_approved",
    }
