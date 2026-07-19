"""Unit — fail-closed TenancyScope over the audit read path (P7a Slice 2, ADR-0017).

The scoping rule ``record_in_scope`` is a pure function (literal inputs, plain
assertions): a matching tenant is in scope, a cross-tenant row is out, a
platform scope sees everything, and a scope bound to no tenant sees nothing
(fail-closed). ``all_records`` takes the scope as a REQUIRED positional argument
so a future read path cannot forget the filter — no scope, no rows (ADR-0017
point 3).

Run from backend/:
    uv run pytest tests/unit/test_tenancy_scope.py -v
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest

from audit.store import all_records, reset_audit_log, write_audit_record
from models.schemas import AuditRecord, CaseLifecycle
from security.tenancy import TenancyScope, record_in_scope


@pytest.fixture(autouse=True)
def _clean_audit_log() -> Iterator[None]:
    reset_audit_log()
    yield
    reset_audit_log()


def _rec(correlation_id: str, tenant_id: str) -> AuditRecord:
    return AuditRecord(
        correlation_id=correlation_id,
        idempotency_key=correlation_id,
        tenant_id=tenant_id,
        lifecycle=CaseLifecycle.appeal,
        scenario_id="scn",
        drug="Ozempic (semaglutide)",
        plan="Cigna Connect 500 PPO",
        timestamp="2026-07-18T12:00:00+00:00",
        duration_ms=1,
        outcome="done",
        provenance="as_is",  # type: ignore[arg-type]
    )


# ---------------------------------------------------------------------------
# Pure scoping rule
# ---------------------------------------------------------------------------


def test_record_in_scope_matching_tenant_is_in_scope() -> None:
    assert record_in_scope("tenant_demo", TenancyScope.for_tenant("tenant_demo"))


def test_record_in_scope_cross_tenant_is_out_of_scope() -> None:
    assert not record_in_scope("tenant_other", TenancyScope.for_tenant("tenant_demo"))


def test_record_in_scope_platform_sees_every_tenant() -> None:
    assert record_in_scope("tenant_demo", TenancyScope.platform())
    assert record_in_scope("tenant_other", TenancyScope.platform())


def test_record_in_scope_no_tenant_scope_sees_nothing() -> None:
    """A non-platform scope bound to no tenant is the fail-closed default —
    it must match no row."""
    assert not record_in_scope("tenant_demo", TenancyScope.for_tenant(None))


# ---------------------------------------------------------------------------
# Store read path — scope is a required positional arg (can't be forgotten)
# ---------------------------------------------------------------------------


def test_all_records_requires_a_scope_argument() -> None:
    with pytest.raises(TypeError):
        all_records()  # type: ignore[call-arg]


def test_all_records_matching_tenant_returns_only_its_rows() -> None:
    write_audit_record(_rec("demo:a1", "tenant_demo"))
    write_audit_record(_rec("other:a1", "tenant_other"))
    rows = all_records(TenancyScope.for_tenant("tenant_demo"))
    assert [r.correlation_id for r in rows] == ["demo:a1"]


def test_all_records_cross_tenant_returns_nothing() -> None:
    write_audit_record(_rec("demo:a1", "tenant_demo"))
    assert all_records(TenancyScope.for_tenant("tenant_absent")) == []


def test_all_records_platform_scope_returns_all() -> None:
    write_audit_record(_rec("demo:a1", "tenant_demo"))
    write_audit_record(_rec("other:a1", "tenant_other"))
    rows = all_records(TenancyScope.platform())
    assert {r.correlation_id for r in rows} == {"demo:a1", "other:a1"}
