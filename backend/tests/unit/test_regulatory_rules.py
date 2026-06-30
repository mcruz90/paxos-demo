"""RED tests for Step 8 — golden/regulatory/ provenance-tracked regulatory rules.

Exercises:
  - RegRuleRecord schema (quote, source_url, authority, confidence non-empty; human_confirmation_required)
  - All 3 required rule_ids present in rules.json
  - provenance.json manifest covers all rule_ids
  - Coverage pool rule_refs cite real rule_ids (no dangling refs)
  - Ozempic/COB coverage cites specific regulatory rules

Sources verified 2026-06-29 against CMS, Medicaid.gov, NPR, GoodRx.
See memory: project_cob_coverage_rules + project_regulatory_grounding.

Run from backend/:
    uv run pytest tests/unit/test_regulatory_rules.py -v
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

_REGULATORY_DIR = (
    Path(__file__).parent.parent.parent / "golden" / "regulatory"
)
_RULES_PATH = _REGULATORY_DIR / "rules.json"
_PROVENANCE_PATH = _REGULATORY_DIR / "provenance.json"

_REQUIRED_RULE_IDS = {
    "cob_primary_governs_pa",
    "medicaid_payer_of_last_resort",
    "copay_card_government_program_exclusion",
}

# ── File / structure ──────────────────────────────────────────────────────────


def test_regulatory_dir_exists() -> None:
    assert _REGULATORY_DIR.exists(), f"Directory not found: {_REGULATORY_DIR}"


def test_rules_json_exists() -> None:
    assert _RULES_PATH.exists(), f"Not found: {_RULES_PATH}"


def test_provenance_json_exists() -> None:
    assert _PROVENANCE_PATH.exists(), f"Not found: {_PROVENANCE_PATH}"


def test_rules_json_is_valid_json() -> None:
    json.loads(_RULES_PATH.read_text(encoding="utf-8"))


def test_provenance_json_is_valid_json() -> None:
    json.loads(_PROVENANCE_PATH.read_text(encoding="utf-8"))


# ── Module import gate ────────────────────────────────────────────────────────


def test_regulatory_module_importable() -> None:
    from golden_set.regulatory import RegRuleRecord, get_rule, load_rules  # noqa: F401


# ── Schema validation ─────────────────────────────────────────────────────────


def test_rules_parse_into_schema() -> None:
    from golden_set.regulatory import load_rules

    rules = load_rules()
    assert len(rules) > 0


def test_all_required_rule_ids_present() -> None:
    from golden_set.regulatory import load_rules

    found = {r.rule_id for r in load_rules()}
    missing = _REQUIRED_RULE_IDS - found
    assert not missing, f"Missing rule_ids: {missing}"


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_has_non_empty_quote(rule_id: str) -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.quote.strip(), f"{rule_id}: quote is empty"


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_has_non_empty_source_url(rule_id: str) -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.source_url.startswith("http"), (
        f"{rule_id}: source_url={rule.source_url!r} must be an http/https URL"
    )


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_has_non_empty_authority(rule_id: str) -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.authority.strip(), f"{rule_id}: authority is empty"


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_confidence_is_high(rule_id: str) -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.confidence == "high", (
        f"{rule_id}: confidence={rule.confidence!r}; expected 'high'"
    )


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_human_confirmation_not_required(rule_id: str) -> None:
    """Rules verified 2026-06-29 against authoritative sources — no human gate needed."""
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.human_confirmation_required is False, (
        f"{rule_id}: human_confirmation_required must be False "
        "(rules verified against authoritative sources 2026-06-29)"
    )


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_last_verified_is_set(rule_id: str) -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule(rule_id)
    assert rule.last_verified, f"{rule_id}: last_verified is empty"


@pytest.mark.parametrize("rule_id", sorted(_REQUIRED_RULE_IDS))
def test_rule_json_round_trip(rule_id: str) -> None:
    from golden_set.regulatory import RegRuleRecord, get_rule

    rule = get_rule(rule_id)
    restored = RegRuleRecord.model_validate_json(rule.model_dump_json())
    assert restored.rule_id == rule.rule_id
    assert restored.quote == rule.quote


# ── Provenance manifest ───────────────────────────────────────────────────────


def test_provenance_manifest_covers_all_rule_ids() -> None:
    """Every rule_id in rules.json must have a corresponding provenance record."""
    from golden_set.regulatory import load_rules

    rules = load_rules()
    rule_ids = {r.rule_id for r in rules}

    raw = json.loads(_PROVENANCE_PATH.read_text(encoding="utf-8"))
    provenance_rule_ids = {rec["rule_id"] for rec in raw.get("records", [])}

    missing = rule_ids - provenance_rule_ids
    assert not missing, (
        f"rule_ids present in rules.json but missing from provenance.json: {missing}"
    )


def test_provenance_records_have_source_url() -> None:
    raw = json.loads(_PROVENANCE_PATH.read_text(encoding="utf-8"))
    for rec in raw.get("records", []):
        assert rec.get("source_url", "").startswith("http"), (
            f"provenance record rule_id={rec.get('rule_id')!r}: source_url missing or non-HTTP"
        )


# ── get_rule() lookup ─────────────────────────────────────────────────────────


def test_get_rule_returns_correct_record() -> None:
    from golden_set.regulatory import get_rule

    rule = get_rule("medicaid_payer_of_last_resort")
    assert rule.rule_id == "medicaid_payer_of_last_resort"
    assert "last resort" in rule.statement.lower()


def test_get_rule_raises_for_unknown_id() -> None:
    from golden_set.regulatory import get_rule

    with pytest.raises(KeyError, match="no_such_rule"):
        get_rule("no_such_rule")


def test_known_rule_ids_frozenset() -> None:
    from golden_set.regulatory import KNOWN_RULE_IDS

    assert _REQUIRED_RULE_IDS <= KNOWN_RULE_IDS


# ── Coverage pool wiring ──────────────────────────────────────────────────────


def test_coverage_record_has_rule_refs_field() -> None:
    from golden_set.coverages import get_coverage_record

    rec = get_coverage_record("ozempic_cigna")
    assert hasattr(rec, "rule_refs"), "CoverageRecord must have rule_refs field"


def test_ozempic_coverage_cites_cob_primary_governs_pa() -> None:
    from golden_set.coverages import get_coverage_record

    rec = get_coverage_record("ozempic_cigna")
    assert "cob_primary_governs_pa" in rec.rule_refs, (
        "ozempic_cigna coverage must cite cob_primary_governs_pa "
        "(primary plan's PA governs; secondary does not re-adjudicate)"
    )


def test_ozempic_coverage_cites_medicaid_payer_of_last_resort() -> None:
    from golden_set.coverages import get_coverage_record

    rec = get_coverage_record("ozempic_cigna")
    assert "medicaid_payer_of_last_resort" in rec.rule_refs, (
        "ozempic_cigna coverage must cite medicaid_payer_of_last_resort "
        "(Medicaid is always secondary; federal law SSA §1902(a)(25))"
    )


def test_ozempic_coverage_cites_copay_card_exclusion() -> None:
    from golden_set.coverages import get_coverage_record

    rec = get_coverage_record("ozempic_cigna")
    assert "copay_card_government_program_exclusion" in rec.rule_refs, (
        "ozempic_cigna coverage must cite copay_card_government_program_exclusion "
        "(Medicaid enrollment bars manufacturer card even as secondary payer)"
    )


def test_no_dangling_rule_refs_in_coverage_pool() -> None:
    """Every rule_ref in coverage_pool.json must resolve to a known regulatory rule_id."""
    from golden_set.coverages import load_coverage_pool
    from golden_set.regulatory import KNOWN_RULE_IDS

    for rec in load_coverage_pool():
        for ref in rec.rule_refs:
            assert ref in KNOWN_RULE_IDS, (
                f"anchor={rec.anchor_id!r}: rule_ref={ref!r} is dangling — "
                f"not in KNOWN_RULE_IDS={sorted(KNOWN_RULE_IDS)}"
            )


def test_esomeprazole_has_no_rule_refs() -> None:
    """Single-commercial scenario has no COB to ground — rule_refs should be empty."""
    from golden_set.coverages import get_coverage_record

    rec = get_coverage_record("esomeprazole_uhc_pediatric")
    assert rec.rule_refs == [], (
        "esomeprazole_uhc_pediatric has no COB — rule_refs must be empty"
    )
