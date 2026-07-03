"""Enum-shape parity guard: backend enums must mirror the frontend contract.

Sprint 1's anchor-join parity guard covers scenario *data*; this covers enum
*shapes*. The motivating drift: frontend CaseStatus gained
'awaiting_documentation' (PH-3101 doc-gap flow) and the backend mirror was
never added (project-review-hardening item 3).

The frontend union in src/types.ts is the source of truth for these enums —
the backend must carry every status the frontend can put on a case.
"""

from __future__ import annotations

import re
from pathlib import Path

from models.schemas import (
    AuditProvenance,
    CaseLifecycle,
    CaseStatus,
    CriterionResult,
    PaDecision,
    RuleType,
)

_TYPES_TS = Path(__file__).resolve().parents[3] / "src" / "types.ts"


def _ts_union_values(type_name: str) -> set[str]:
    """Extract the string-literal members of `export type <name> = 'a' | 'b' ...`."""
    source = _TYPES_TS.read_text(encoding="utf-8")
    match = re.search(
        rf"export\s+type\s+{type_name}\s*=\s*((?:'[^']+'\s*\|?\s*)+)", source
    )
    assert match, f"Could not find `export type {type_name}` in {_TYPES_TS}"
    return set(re.findall(r"'([^']+)'", match.group(1)))


def _ts_interface_keys(interface_name: str) -> set[str]:
    """Extract the property names of `export interface <name> { ... }`.

    The closing brace of a top-level interface sits at column 0, so the
    non-greedy match stops there — inline object literals inside property
    types (e.g. `{ source: string }[]`) never span a line start.
    """
    source = _TYPES_TS.read_text(encoding="utf-8")
    match = re.search(
        rf"export\s+interface\s+{interface_name}\s*\{{(.*?)^\}}",
        source,
        re.DOTALL | re.MULTILINE,
    )
    assert match, f"Could not find `export interface {interface_name}` in {_TYPES_TS}"
    keys: set[str] = set()
    for line in match.group(1).splitlines():
        prop = re.match(r"([A-Za-z_][A-Za-z0-9_]*)\??:", line.strip())
        if prop:
            keys.add(prop.group(1))
    return keys


def test_case_status_matches_frontend_union() -> None:
    frontend = _ts_union_values("CaseStatus")
    backend = {member.value for member in CaseStatus}
    assert backend == frontend, (
        f"CaseStatus drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )


def test_rule_type_matches_frontend_union() -> None:
    frontend = _ts_union_values("RuleType")
    backend = {member.value for member in RuleType}
    assert backend == frontend, (
        f"RuleType drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )


def test_case_lifecycle_matches_frontend_union() -> None:
    frontend = _ts_union_values("CaseLifecycle")
    backend = {member.value for member in CaseLifecycle}
    assert backend == frontend, (
        f"CaseLifecycle drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )


def test_pa_decision_matches_frontend_union() -> None:
    """PaDecision (S2 Slice 1) — the determination decision the initial-PA
    lifecycle branches on. New enum ⇒ types.ts mirror + parity coverage."""
    frontend = _ts_union_values("PaDecision")
    backend = {member.value for member in PaDecision}
    assert backend == frontend, (
        f"PaDecision drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )


def test_criterion_result_fields_match_frontend_interface() -> None:
    """CriterionResult field-shape parity (S3 Slice 1) — the interface is
    shared request/fixture vocabulary on both sides; a field that exists on
    one side only is contract drift (backend compares by alias, the wire
    name the frontend sees)."""
    frontend = _ts_interface_keys("CriterionResult")
    backend = {
        field.alias or name for name, field in CriterionResult.model_fields.items()
    }
    assert backend == frontend, (
        f"CriterionResult drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )


def test_criterion_result_has_confidence_on_both_sides() -> None:
    """S3 Slice 1 anchor: the 0–1 confidence field the TierRouter bands
    route against must exist on the backend model and the types.ts mirror."""
    assert "confidence" in CriterionResult.model_fields, (
        "backend CriterionResult is missing 'confidence'"
    )
    assert "confidence" in _ts_interface_keys("CriterionResult"), (
        "types.ts CriterionResult is missing 'confidence'"
    )


def test_audit_provenance_matches_frontend_union() -> None:
    """AuditProvenance (S2 Slice 4) — AI-accountability provenance on every
    audit entry. New enum ⇒ types.ts mirror + parity coverage."""
    frontend = _ts_union_values("AuditProvenance")
    backend = {member.value for member in AuditProvenance}
    assert backend == frontend, (
        f"AuditProvenance drift — backend-only: {backend - frontend}, "
        f"frontend-only: {frontend - backend}"
    )
