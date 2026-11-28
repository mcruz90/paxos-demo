"""Resolve the payer policy applicable to a specific request."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Literal, Self

from pydantic import BaseModel, Field, TypeAdapter, ValidationError, model_validator

from agents.policy_trace import (
    HoldReason,
    PolicyCandidateElimination,
    PolicyResolutionTrace,
    PolicyStage,
)
from errors import ETLParseError
from models.schemas import PaResolution

_REQUIREMENTS_PATH = Path(__file__).parent.parent / "data" / "pa_requirements.json"
_ICD10_CODE = re.compile(r"(?<![\w.])[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?(?!\w|\.[A-Z0-9])")
_STRENGTH = re.compile(
    r"(?<![\w./-])\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|units?)"
    r"(?:\s*/\s*(?:\d+(?:\.\d+)?\s*)?ml)?(?![\w/-])"
)
_PRODUCT_WITH_INGREDIENT = re.compile(r"([^()]+) \(([^()]+)\)(.*)")

_HOLD_MESSAGES: dict[HoldReason, str] = {
    "missing_policy": "Obtain the policy for the requested plan.",
    "product_mismatch": "Confirm the requested product and formulation.",
    "missing_indication": "Confirm the indication for the request.",
    "indication_mismatch": "Confirm the indication and obtain its policy.",
    "missing_effective_date": "Confirm the policy applicability date.",
    "no_effective_version": "Obtain the policy version in effect on that date.",
    "ambiguous_policy": "Verify the applicable policy version with the payer.",
}


class AutoProcessRule(BaseModel):
    under_years: int = Field(strict=True, ge=1, le=125)
    source: str = Field(min_length=1)
    quote: str = Field(min_length=1)


class _PaPack(BaseModel):
    pack_id: str | None = None
    anchor_id: str | None = None
    plan_id: str
    criteria_text: str = Field(min_length=1)
    drug_aliases: list[str] = Field(min_length=1)
    auto_process: AutoProcessRule | None = None
    indications: list[str] = Field(min_length=1)
    icd10_codes: list[str] = Field(default_factory=list)
    icd10_categories: list[str] = Field(default_factory=list)
    effective_from: date
    effective_until: date | None = None

    @model_validator(mode="after")
    def validate_effective_window(self) -> Self:
        if self.effective_until is not None and self.effective_until <= self.effective_from:
            raise ValueError("effective_until must be after effective_from")
        return self

    def applies_on(self, as_of: date) -> bool:
        return self.effective_from <= as_of and (
            self.effective_until is None or as_of < self.effective_until
        )


_PacksAdapter = TypeAdapter(dict[str, _PaPack])


def _load_requirements() -> dict[str, list[_PaPack]]:
    """Load and validate the registry once, retaining every pack for each plan."""
    try:
        raw = json.loads(_REQUIREMENTS_PATH.read_text(encoding="utf-8"))
        packs = _PacksAdapter.validate_python(raw["packs"])
    except json.JSONDecodeError as exc:
        raise ETLParseError(f"pa_requirements.json is malformed: {exc}") from exc
    except (KeyError, TypeError, ValidationError) as exc:
        raise ETLParseError(f"pa_requirements.json has an invalid pack: {exc}") from exc

    by_plan_id: dict[str, list[_PaPack]] = defaultdict(list)
    for pack_key, pack in packs.items():
        bound = pack if pack.pack_id else pack.model_copy(update={"pack_id": pack_key})
        by_plan_id[bound.plan_id].append(bound)
    return dict(by_plan_id)


_BY_PLAN_ID = _load_requirements()


def _normalize_label(value: str) -> str:
    return " ".join(value.casefold().split())


def _matches(value: str, labels: list[str]) -> bool:
    normalized = _normalize_label(value)
    return bool(normalized) and any(normalized == _normalize_label(label) for label in labels)


def _matches_product(value: str, pack: _PaPack) -> bool:
    label = _normalize_label(_STRENGTH.sub(" ", value.casefold()))
    if _matches(label, pack.drug_aliases):
        return True
    pair = _PRODUCT_WITH_INGREDIENT.fullmatch(label)
    if pair is None:
        return False
    first, second, formulation = pair.groups()
    return _matches(f"{second} ({first}){formulation}", pack.drug_aliases)


def _matches_indication(value: str, pack: _PaPack) -> bool:
    codes = _ICD10_CODE.findall(value.upper())
    if not codes:
        return _matches(value, pack.indications)
    return all(
        code in pack.icd10_codes or code.partition(".")[0] in pack.icd10_categories
        for code in codes
    )


def _hold_message(reason: HoldReason) -> str:
    return f"Policy hold ({reason}). {_HOLD_MESSAGES[reason]}"


def _pack_label(pack: _PaPack, index: int) -> str:
    return pack.pack_id or pack.anchor_id or f"{pack.plan_id}#{index}"


def _record(
    pack: _PaPack,
    pack_id: str,
    outcome: Literal["selected", "eliminated", "ambiguous"],
    stage: PolicyStage,
    reason: str,
) -> PolicyCandidateElimination:
    return PolicyCandidateElimination(
        pack_id=pack_id,
        plan_id=pack.plan_id,
        outcome=outcome,
        stage=stage,
        reason=reason,
        effective_from=pack.effective_from,
        effective_until=pack.effective_until,
    )


def _evaluate_candidate(
    pack: _PaPack,
    drug: str,
    diagnosis: str,
    has_diagnosis: bool,
    as_of: date | None,
) -> tuple[PolicyStage, HoldReason | None]:
    if not _matches_product(drug, pack):
        return "product", "product_mismatch"
    if not has_diagnosis:
        return "indication", "missing_indication"
    if not _matches_indication(diagnosis, pack):
        return "indication", "indication_mismatch"
    if as_of is None:
        return "effective_date", "missing_effective_date"
    if not pack.applies_on(as_of):
        return "effective_date", "no_effective_version"
    return "selected", None


def _hold_trace(
    plan_id: str,
    drug: str,
    diagnosis: str,
    as_of: date | None,
    stage: PolicyStage,
    reason: HoldReason,
    rows: list[PolicyCandidateElimination],
) -> PolicyResolutionTrace:
    return PolicyResolutionTrace(
        plan_id=plan_id,
        drug=drug,
        diagnosis=diagnosis,
        as_of=as_of,
        resolution="generic",
        stage=stage,
        selected_pack_id=None,
        pack=None,
        criteria_text=None,
        hold_reason=reason,
        hold_message=_hold_message(reason),
        total_candidates=len(rows),
        candidates=tuple(rows),
    )


def _scan_candidates(
    candidates: list[_PaPack], drug: str, diagnosis: str, as_of: date | None
) -> tuple[list[PolicyCandidateElimination], list[tuple[str, _PaPack]], PolicyStage, HoldReason]:
    has_diagnosis = bool(diagnosis.strip())
    rows: list[PolicyCandidateElimination] = []
    survivors: list[tuple[str, _PaPack]] = []
    furthest_stage: PolicyStage = "product"
    furthest_reason: HoldReason = "product_mismatch"
    stage_rank = {"product": 1, "indication": 2, "effective_date": 3}

    for idx, pack in enumerate(candidates):
        pack_id = _pack_label(pack, idx)
        stage, reason = _evaluate_candidate(pack, drug, diagnosis, has_diagnosis, as_of)
        if reason is None:
            survivors.append((pack_id, pack))
            continue
        rows.append(_record(pack, pack_id, "eliminated", stage, reason))
        if stage_rank[stage] > stage_rank[furthest_stage]:
            furthest_stage = stage
            furthest_reason = reason
    return rows, survivors, furthest_stage, furthest_reason


def resolve_pack_with_trace(
    plan_id: str,
    drug: str,
    *,
    diagnosis: str = "",
    as_of: date | None = None,
) -> PolicyResolutionTrace:
    """Resolve candidate packs in one deterministic pass and emit an elimination trace.

    Products match a whole label after strength and order normalization.
    Indications use ICD-10 when present and whole labels otherwise. Effective
    intervals include the start and exclude the end.
    """
    candidates = _BY_PLAN_ID.get(plan_id)
    if not candidates:
        return _hold_trace(plan_id, drug, diagnosis, as_of, "plan_lookup", "missing_policy", [])

    rows, survivors, furthest_stage, furthest_reason = _scan_candidates(
        candidates, drug, diagnosis, as_of
    )
    if not survivors:
        return _hold_trace(plan_id, drug, diagnosis, as_of, furthest_stage, furthest_reason, rows)

    if len(survivors) > 1:
        for pack_id, pack in survivors:
            rows.append(_record(pack, pack_id, "ambiguous", "uniqueness", "ambiguous_policy"))
        return _hold_trace(plan_id, drug, diagnosis, as_of, "uniqueness", "ambiguous_policy", rows)

    winner_id, winner = survivors[0]
    rows.append(_record(winner, winner_id, "selected", "selected", "matched"))
    return PolicyResolutionTrace(
        plan_id=plan_id,
        drug=drug,
        diagnosis=diagnosis,
        as_of=as_of,
        resolution="plan_id",
        stage="selected",
        selected_pack_id=winner_id,
        pack=winner,
        criteria_text=winner.criteria_text,
        hold_reason=None,
        hold_message=None,
        total_candidates=len(rows),
        candidates=tuple(rows),
    )


def resolve_pack(
    plan_id: str,
    drug: str,
    *,
    diagnosis: str = "",
    as_of: date | None = None,
) -> tuple[_PaPack | str, PaResolution]:
    """Return the matched policy pack, or a named hold and next action.

    The second tuple item distinguishes criteria ("plan_id") from the hold message
    ("generic"). Products match a whole label after strength and order
    normalization. Indications use ICD-10 when present and whole labels
    otherwise. Effective intervals include the start and exclude the end.
    """
    trace = resolve_pack_with_trace(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    if trace.pack is not None:
        return trace.pack, "plan_id"
    if trace.hold_message is None:
        raise RuntimeError("Policy hold trace missing hold_message")
    return trace.hold_message, "generic"


def resolve_requirements(
    plan_id: str, drug: str, *, diagnosis: str = "", as_of: date | None = None
) -> tuple[str, PaResolution]:
    pack, resolution = resolve_pack(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    return (pack if isinstance(pack, str) else pack.criteria_text), resolution
