"""agents/requirements_lookup.py — PA requirements registry lookup.

Extracted from agents/nodes/retrieval.py when the CRD-check node became its
second consumer (S2 Slice 2; CLAUDE.md DRY — extract on the second
occurrence). Pure lookup: no DB calls, no LLM calls; file I/O happens once at
module load (fail-fast at boot is intentional — see
docs/project-review-hardening.md deferred items).

Resolution order:
  1. Exact plan_id match (most specific — identifies the payer policy).
  2. Drug alias substring match on the drug name, when plan_id is unknown.
     It is recorded ("drug_alias") but lends NO criteria: another plan's pack
     says nothing about this plan, so the context is the generic text and the
     case goes to a person (ADR-0019).
  3. Generic fallback — never raises.

Sprint 5 hook: extend to (BIN/PCN/Group + market + tier) via golden/coverage_pool.json.
See _S5_COVERAGE_HOOK comment in data/pa_requirements.json.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, TypeAdapter, ValidationError

from errors import ETLParseError
from models.schemas import PaResolution

_REQUIREMENTS_PATH = Path(__file__).parent.parent / "data" / "pa_requirements.json"


class _PaPack(BaseModel):
    """Shape of one entry in pa_requirements.json's 'packs' object.

    Validated up front so a malformed pack raises ETLParseError (a typed,
    diagnosable error) instead of a bare KeyError deep in dict access.
    """

    plan_id: str
    criteria_text: str
    drug_aliases: list[str]


_PacksAdapter = TypeAdapter(dict[str, _PaPack])

GENERIC_CONTEXT = (
    "PA Requirements — General:\n"
    "Prior authorization is required for this medication. "
    "Submit clinical documentation including diagnosis codes, "
    "failed alternative therapies, and prescriber specialty. "
    "Contact the plan's PA department for drug-specific criteria."
)


def _load_requirements() -> tuple[dict[str, str], frozenset[str]]:
    """Load pa_requirements.json and build the plan_id lookup and alias set.

    Returns:
        (by_plan_id, drug_aliases) — plan_id → criteria_text, and every pack's
        lower-cased drug aliases. Aliases map to no criteria on purpose
        (ADR-0019): they only say "this drug has a pack under some plan".

    Raises:
        ETLParseError: If the JSON file is malformed or a pack is missing a
            required field (plan_id, criteria_text, drug_aliases).
        FileNotFoundError: If the file is missing (propagated — fail fast).
    """
    try:
        raw = json.loads(_REQUIREMENTS_PATH.read_text(encoding="utf-8"))
        packs = _PacksAdapter.validate_python(raw["packs"])
    except json.JSONDecodeError as exc:
        raise ETLParseError(f"pa_requirements.json is malformed: {exc}") from exc
    except (KeyError, ValidationError) as exc:
        raise ETLParseError(f"pa_requirements.json has an invalid pack: {exc}") from exc

    by_plan_id = {pack.plan_id: pack.criteria_text for pack in packs.values()}
    drug_aliases = frozenset(
        alias.lower() for pack in packs.values() for alias in pack.drug_aliases
    )
    return by_plan_id, drug_aliases


_BY_PLAN_ID, _DRUG_ALIASES = _load_requirements()


def resolve_requirements(plan_id: str, drug: str) -> tuple[str, PaResolution]:
    """Resolve PA criteria text for a drug × plan.

    Resolution order: exact plan_id → drug alias substring → generic fallback.
    Only a plan_id hit supplies payer criteria. A drug-alias hit returns the
    generic text with resolution "drug_alias" (never another plan's criteria,
    ADR-0019). Never raises; always returns a non-empty criteria string plus
    which path fired (audit-relevant — a generic-fallback artifact is
    materially different from a payer-specific one, hard-5).

    Args:
        plan_id: Payer plan identifier (e.g. "CIGNA-CNF360-2024").
        drug: Drug name as requested (brand and/or INN).

    Returns:
        (criteria_text, resolution) — resolution ∈ {"plan_id", "drug_alias",
        "generic"}.
    """
    criteria = _BY_PLAN_ID.get(plan_id)
    if criteria is not None:
        return criteria, "plan_id"
    drug_lower = drug.lower()
    if any(alias in drug_lower for alias in _DRUG_ALIASES):
        return GENERIC_CONTEXT, "drug_alias"
    return GENERIC_CONTEXT, "generic"
