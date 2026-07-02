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

from models.schemas import CaseStatus, RuleType

_TYPES_TS = Path(__file__).resolve().parents[3] / "src" / "types.ts"


def _ts_union_values(type_name: str) -> set[str]:
    """Extract the string-literal members of `export type <name> = 'a' | 'b' ...`."""
    source = _TYPES_TS.read_text(encoding="utf-8")
    match = re.search(
        rf"export\s+type\s+{type_name}\s*=\s*((?:'[^']+'\s*\|?\s*)+)", source
    )
    assert match, f"Could not find `export type {type_name}` in {_TYPES_TS}"
    return set(re.findall(r"'([^']+)'", match.group(1)))


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
