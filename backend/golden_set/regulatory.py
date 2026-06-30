"""Regulatory rule registry — loaded from backend/golden/regulatory/rules.json.

Provenance-tracked COB and affordability rules underpinning case-packet coverage
labels. Mirrors golden_set/coverages.py discipline (JSON data → Pydantic loader).

To add a new rule: append an entry to golden/regulatory/rules.json. No Python
edits required unless the schema changes. Every rule must have a non-empty
source_url and a verbatim or near-verbatim quote from that source.

These are the first records in the regulatory-grounding pattern described in
project_regulatory_grounding memory: hypothesize → verify → cite.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

_RULES_PATH = Path(__file__).parent.parent / "golden" / "regulatory" / "rules.json"


class RegRuleRecord(BaseModel):
    """A single provenance-tracked regulatory rule."""

    rule_id: str
    statement: str
    authority: str
    source_url: str
    corroborating_url: str = ""
    retrieved_date: str          # YYYY-MM-DD
    quote: str                   # Verbatim or near-verbatim from source
    effective_context: str
    confidence: Literal["high", "medium", "low"]
    last_verified: str           # YYYY-MM-DD
    human_confirmation_required: bool

    model_config = {"extra": "ignore"}


class _RulesFile(BaseModel):
    schema_version: str
    rules: list[RegRuleRecord]

    model_config = {"extra": "ignore"}


def load_rules() -> list[RegRuleRecord]:
    """Load and validate all regulatory rules from rules.json."""
    try:
        return _RulesFile.model_validate_json(
            _RULES_PATH.read_text(encoding="utf-8")
        ).rules
    except Exception as exc:
        raise RuntimeError(
            f"Cannot load regulatory rules from {_RULES_PATH}: {exc}"
        ) from exc


_RULES: list[RegRuleRecord] = load_rules()
_RULES_BY_ID: dict[str, RegRuleRecord] = {r.rule_id: r for r in _RULES}


def get_rule(rule_id: str) -> RegRuleRecord:
    """Return the RegRuleRecord for *rule_id*.

    Raises KeyError with a clear message if the rule_id is not in the registry.
    To add a rule: append an entry to backend/golden/regulatory/rules.json.
    """
    try:
        return _RULES_BY_ID[rule_id]
    except KeyError:
        known = sorted(_RULES_BY_ID)
        raise KeyError(
            f"No regulatory rule found for rule_id={rule_id!r}. "
            f"Known rule_ids: {known}. "
            f"Add an entry to {_RULES_PATH}."
        ) from None


KNOWN_RULE_IDS: frozenset[str] = frozenset(_RULES_BY_ID)
