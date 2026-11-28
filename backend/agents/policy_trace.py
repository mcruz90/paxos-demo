"""Structured elimination trace models for single-pass policy resolution (PTC-03)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import TYPE_CHECKING, Literal

from models.schemas import PaResolution

if TYPE_CHECKING:
    from agents.requirements_lookup import _PaPack

PolicyStage = Literal[
    "plan_lookup",
    "product",
    "indication",
    "effective_date",
    "uniqueness",
    "selected",
]

HoldReason = Literal[
    "missing_policy",
    "product_mismatch",
    "missing_indication",
    "indication_mismatch",
    "missing_effective_date",
    "no_effective_version",
    "ambiguous_policy",
]


@dataclass(frozen=True)
class PolicyCandidateElimination:
    pack_id: str
    plan_id: str
    outcome: Literal["selected", "eliminated", "ambiguous"]
    stage: PolicyStage
    reason: str
    effective_from: date
    effective_until: date | None = None


@dataclass(frozen=True)
class PolicyResolutionTrace:
    plan_id: str
    drug: str
    diagnosis: str
    as_of: date | None
    resolution: PaResolution
    stage: PolicyStage
    selected_pack_id: str | None
    pack: _PaPack | None
    criteria_text: str | None
    hold_reason: HoldReason | None
    hold_message: str | None
    total_candidates: int
    candidates: tuple[PolicyCandidateElimination, ...]

    @property
    def eliminated(self) -> tuple[PolicyCandidateElimination, ...]:
        return tuple(row for row in self.candidates if row.outcome == "eliminated")
