"""Resolve the payer policy applicable to a specific request."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Self

from pydantic import BaseModel, Field, TypeAdapter, ValidationError, model_validator

from errors import ETLParseError
from models.schemas import PaResolution

_REQUIREMENTS_PATH = Path(__file__).parent.parent / "data" / "pa_requirements.json"
_ICD10_CODE = re.compile(r"(?<![\w.])[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?(?!\w|\.[A-Z0-9])")
_STRENGTH = re.compile(
    r"(?<![\w./-])\d+(?:\.\d+)?\s*(?:mcg|mg|g|ml|units?)"
    r"(?:\s*/\s*(?:\d+(?:\.\d+)?\s*)?ml)?(?![\w/-])"
)
_PRODUCT_WITH_INGREDIENT = re.compile(r"([^()]+) \(([^()]+)\)(.*)")


class AutoProcessRule(BaseModel):
    under_years: int = Field(strict=True, ge=1, le=125)
    source: str = Field(min_length=1)
    quote: str = Field(min_length=1)


class _PaPack(BaseModel):
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
    for pack in packs.values():
        by_plan_id[pack.plan_id].append(pack)
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


def _hold(reason: str, next_action: str) -> tuple[str, PaResolution]:
    return f"Policy hold ({reason}). {next_action}", "generic"


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
    candidates = _BY_PLAN_ID.get(plan_id)
    if not candidates:
        return _hold("missing_policy", "Obtain the policy for the requested plan.")

    candidates = [pack for pack in candidates if _matches_product(drug, pack)]
    if not candidates:
        return _hold("product_mismatch", "Confirm the requested product and formulation.")

    if not diagnosis.strip():
        return _hold("missing_indication", "Confirm the indication for the request.")
    candidates = [pack for pack in candidates if _matches_indication(diagnosis, pack)]
    if not candidates:
        return _hold("indication_mismatch", "Confirm the indication and obtain its policy.")

    if as_of is None:
        return _hold("missing_effective_date", "Confirm the policy applicability date.")
    candidates = [pack for pack in candidates if pack.applies_on(as_of)]
    if not candidates:
        return _hold("no_effective_version", "Obtain the policy version in effect on that date.")
    if len(candidates) > 1:
        return _hold("ambiguous_policy", "Verify the applicable policy version with the payer.")

    return candidates[0], "plan_id"


def resolve_requirements(
    plan_id: str, drug: str, *, diagnosis: str = "", as_of: date | None = None
) -> tuple[str, PaResolution]:
    pack, resolution = resolve_pack(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    return (pack if isinstance(pack, str) else pack.criteria_text), resolution
