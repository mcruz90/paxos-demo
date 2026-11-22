"""Check provenance and fail closed if the structured policy changes independently."""

from datetime import date
from pathlib import Path

from agents.requirements_lookup import resolve_pack
from tests.unit.test_case_readiness import AGE, TUBE, assess, source


def test_structured_rule_is_pinned_and_cited(monkeypatch):
    pack, _ = resolve_pack(
        "UHC-CHOICE-2026", "Nexium oral suspension", diagnosis="K21.0", as_of=date(2026, 5, 14)
    )
    rule = pack.auto_process
    assert rule.quote in (Path(__file__).parents[2] / rule.source).read_text(encoding="utf-8")
    monkeypatch.setattr(rule, "under_years", rule.under_years + 1)
    assert assess(source(AGE + "\n" + TUBE)).blockers == ("policy_review",)


def test_improbable_chart_age_cannot_bypass_cross_check():
    result = assess(source("Age at request: 126 years."), dob=date(2022, 1, 1))
    assert "age" in result.blockers and result.pathway is None
