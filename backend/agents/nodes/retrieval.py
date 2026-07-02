"""agents/nodes/retrieval.py — PA requirement lookup from data/pa_requirements.json.

Node contract: (PipelineState) -> PipelineState
Pure function — no DB calls, no LLM calls.

Resolution order (Sprint 1):
  1. Exact plan_id match (most specific — identifies the payer policy).
  2. Drug alias substring match on request.drug (fallback when plan_id unknown).
  3. Generic fallback — never raises.

Sprint 5 hook: extend to (BIN/PCN/Group + market + tier) via golden/coverage_pool.json.
See _S5_COVERAGE_HOOK comment in data/pa_requirements.json.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, TypeAdapter, ValidationError

from errors import ETLParseError
from models.schemas import PaResolution, PipelineState

_REQUIREMENTS_PATH = Path(__file__).parent.parent.parent / "data" / "pa_requirements.json"


class _PaPack(BaseModel):
    """Shape of one entry in pa_requirements.json's 'packs' object.

    Validated up front so a malformed pack raises ETLParseError (a typed,
    diagnosable error) instead of a bare KeyError deep in dict access.
    """

    plan_id: str
    criteria_text: str
    drug_aliases: list[str]


_PacksAdapter = TypeAdapter(dict[str, _PaPack])

_GENERIC_CONTEXT = (
    "PA Requirements — General:\n"
    "Prior authorization is required for this medication. "
    "Submit clinical documentation including diagnosis codes, "
    "failed alternative therapies, and prescriber specialty. "
    "Contact the plan's PA department for drug-specific criteria."
)


def _load_requirements() -> tuple[dict[str, str], dict[str, str]]:
    """Load pa_requirements.json and build plan_id and drug-alias lookup dicts.

    Returns:
        (by_plan_id, by_drug_alias) — both map a key to a criteria_text string.

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

    by_plan_id: dict[str, str] = {}
    by_drug_alias: dict[str, str] = {}

    for pack in packs.values():
        by_plan_id[pack.plan_id] = pack.criteria_text
        for alias in pack.drug_aliases:
            by_drug_alias.setdefault(alias.lower(), pack.criteria_text)

    return by_plan_id, by_drug_alias


_BY_PLAN_ID, _BY_DRUG_ALIAS = _load_requirements()


def run_retrieval(state: PipelineState) -> PipelineState:
    """Look up PA requirements and populate *pa_context*.

    Resolution order: exact plan_id → drug alias substring → generic fallback.
    Never raises; always returns a non-empty pa_context string.

    Args:
        state: Current pipeline state with an initialized AppealRequest.

    Returns:
        Updated state with ``pa_context`` populated. Input state is not mutated.
    """
    plan_id = state["request"].plan_id
    drug_lower = state["request"].drug.lower()

    pa_context = _BY_PLAN_ID.get(plan_id)
    pa_resolution: PaResolution = "plan_id"

    if pa_context is None:
        pa_resolution = "drug_alias"
        for alias, text in _BY_DRUG_ALIAS.items():
            if alias in drug_lower:
                pa_context = text
                break

    if pa_context is None:
        pa_context = _GENERIC_CONTEXT
        pa_resolution = "generic"

    return {**state, "pa_context": pa_context, "pa_resolution": pa_resolution}
