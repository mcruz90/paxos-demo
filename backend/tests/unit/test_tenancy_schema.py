"""Unit — tenancy schema seam (P7a Slice 1, ADR-0017).

Spec-first: every case-bearing object gains ``tenant_id`` (defaulting to the
seeded pre-DB tenant so demo/live behavior is unchanged, ADR-0017 Q3) plus an
optional ``patient_ref`` (the tokenized working identifier, absent on existing
flows). ``tenant_id`` is a column, NEVER folded into the correlation ID /
idempotency key (ADR-0017 Q2) — that guard is covered where the keys are
derived; here we pin the field shapes.

Run from backend/:
    uv run pytest tests/unit/test_tenancy_schema.py -v
"""

from __future__ import annotations

from models.schemas import (
    SEEDED_TENANT_ID,
    AppealRequest,
    AuditRecord,
    CaseLifecycle,
    InitialPaRequest,
)


def _appeal(**overrides: object) -> AppealRequest:
    base: dict[str, object] = {
        "scenario_id": "tenancy-scn",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": "Authorization denied.",
        "denial_reason": "step therapy",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "criteria_results": [],
    }
    base.update(overrides)
    return AppealRequest(**base)  # type: ignore[arg-type]


def _initial_pa(**overrides: object) -> InitialPaRequest:
    base: dict[str, object] = {
        "scenario_id": "tenancy-scn",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic",
        "criteria_results": [],
    }
    base.update(overrides)
    return InitialPaRequest(**base)  # type: ignore[arg-type]


def _audit(**overrides: object) -> AuditRecord:
    base: dict[str, object] = {
        "correlation_id": "tenancy-scn:a1",
        "idempotency_key": "tenancy-scn:a1",
        "lifecycle": CaseLifecycle.appeal,
        "scenario_id": "tenancy-scn",
        "drug": "Ozempic (semaglutide)",
        "plan": "Cigna Connect 500 PPO",
        "timestamp": "2026-07-18T12:00:00+00:00",
        "duration_ms": 1,
        "outcome": "done",
        "provenance": "as_is",
    }
    base.update(overrides)
    return AuditRecord(**base)  # type: ignore[arg-type]


def test_seeded_tenant_id_is_tenant_demo() -> None:
    assert SEEDED_TENANT_ID == "tenant_demo"


def test_appeal_request_defaults_to_seeded_tenant_and_no_patient() -> None:
    req = _appeal()
    assert req.tenant_id == SEEDED_TENANT_ID
    assert req.patient_ref is None


def test_initial_pa_request_defaults_to_seeded_tenant_and_no_patient() -> None:
    req = _initial_pa()
    assert req.tenant_id == SEEDED_TENANT_ID
    assert req.patient_ref is None


def test_audit_record_defaults_to_seeded_tenant_and_no_patient() -> None:
    rec = _audit()
    assert rec.tenant_id == SEEDED_TENANT_ID
    assert rec.patient_ref is None


def test_case_bearing_objects_carry_explicit_tenant_and_patient() -> None:
    appeal = _appeal(tenant_id="tenant_other", patient_ref="PT-0042")
    pa = _initial_pa(tenant_id="tenant_other", patient_ref="PT-0042")
    rec = _audit(tenant_id="tenant_other", patient_ref="PT-0042")
    for obj in (appeal, pa, rec):
        assert obj.tenant_id == "tenant_other"
        assert obj.patient_ref == "PT-0042"
