"""Compatibility checks against a registry with synthetic products and versions."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from agents import requirements_lookup
from agents.requirements_lookup import resolve_requirements

_POLICY = {
    "plan_id": "SYNTHETIC-PLAN",
    "drug_aliases": ["Synthetic product oral suspension"],
    "indications": ["Synthetic indication A"],
    "effective_from": "2025-01-01",
    "effective_until": "2026-01-01",
    "criteria_text": "Synthetic payer criteria v1.",
}


@pytest.fixture
def synthetic_registry(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "requirements.json"
    path.write_text(
        json.dumps(
            {
                "packs": {
                    "v1": _POLICY,
                    "v2": {
                        **_POLICY,
                        "effective_from": "2026-01-01",
                        "effective_until": None,
                        "criteria_text": "Synthetic payer criteria v2.",
                    },
                    "overlap": {
                        **_POLICY,
                        "effective_from": "2025-06-01",
                        "effective_until": "2025-07-01",
                        "criteria_text": "Overlapping synthetic payer criteria.",
                    },
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(requirements_lookup, "_REQUIREMENTS_PATH", path)
    monkeypatch.setattr(
        requirements_lookup, "_BY_PLAN_ID", requirements_lookup._load_requirements()
    )


@pytest.mark.usefixtures("synthetic_registry")
@pytest.mark.parametrize(
    ("as_of", "expected"),
    [
        (date(2025, 1, 1), "Synthetic payer criteria v1."),
        (date(2025, 7, 1), "Synthetic payer criteria v1."),
        (date(2026, 1, 1), "Synthetic payer criteria v2."),
    ],
)
def test_selects_the_compatible_effective_version(as_of: date, expected: str) -> None:
    assert resolve_requirements(
        "SYNTHETIC-PLAN",
        " Synthetic PRODUCT oral suspension ",
        diagnosis="synthetic indication A",
        as_of=as_of,
    ) == (expected, "plan_id")


_HOLD_CASES = [
    (
        "OTHER-PLAN",
        "Synthetic product oral suspension",
        "Synthetic indication A",
        date(2025, 1, 1),
        "missing_policy",
        "Obtain",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product capsule",
        "Synthetic indication A",
        date(2025, 1, 1),
        "product_mismatch",
        "Confirm",
    ),
    (
        "SYNTHETIC-PLAN",
        "Unrelated Synthetic product oral suspension",
        "Synthetic indication A",
        date(2025, 1, 1),
        "product_mismatch",
        "Confirm",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product oral suspension",
        "Synthetic indication B",
        date(2025, 1, 1),
        "indication_mismatch",
        "Confirm",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product oral suspension",
        "",
        date(2025, 1, 1),
        "missing_indication",
        "Confirm",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product oral suspension",
        "Synthetic indication A",
        date(2024, 12, 31),
        "no_effective_version",
        "Obtain",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product oral suspension",
        "Synthetic indication A",
        None,
        "missing_effective_date",
        "Confirm",
    ),
    (
        "SYNTHETIC-PLAN",
        "Synthetic product oral suspension",
        "Synthetic indication A",
        date(2025, 6, 1),
        "ambiguous_policy",
        "Verify",
    ),
]


@pytest.mark.usefixtures("synthetic_registry")
@pytest.mark.parametrize(
    ("plan", "drug", "diagnosis", "as_of", "reason", "next_action"), _HOLD_CASES
)
def test_unresolved_compatibility_holds_without_payer_criteria(
    plan: str, drug: str, diagnosis: str, as_of: date | None, reason: str, next_action: str
) -> None:
    context, resolution = resolve_requirements(plan, drug, diagnosis=diagnosis, as_of=as_of)

    assert resolution == "generic"
    assert reason in context
    assert next_action in context
    assert "payer criteria v" not in context
    assert "Overlapping synthetic payer criteria" not in context
