"""Unit tests for PTC-03 single-pass policy fan-out and trace."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from agents import requirements_lookup
from agents.policy_trace import PolicyCandidateElimination, PolicyResolutionTrace
from agents.requirements_lookup import (
    resolve_pack,
    resolve_pack_with_trace,
    resolve_requirements,
)

_BASE: dict[str, Any] = {
    "plan_id": "MULTI-PLAN",
    "drug_aliases": ["TargetDrug (samplemab)"],
    "indications": ["Rheumatoid Arthritis"],
    "icd10_categories": ["M05"],
    "effective_from": "2025-01-01",
    "effective_until": "2027-01-01",
}
_MULTI_PACKS: dict[str, dict[str, Any]] = {
    "wrong_drug": {
        **_BASE,
        "drug_aliases": ["OtherDrug oral tablet"],
        "criteria_text": "OtherDrug criteria.",
    },
    "wrong_indication": {
        **_BASE,
        "indications": ["Psoriatic Arthritis"],
        "icd10_categories": [],
        "icd10_codes": ["L40.5"],
        "criteria_text": "TargetDrug PsA criteria.",
    },
    "expired_v1": {
        **_BASE,
        "effective_from": "2024-01-01",
        "effective_until": "2025-06-01",
        "criteria_text": "TargetDrug RA v1 criteria.",
    },
    "future_v3": {
        **_BASE,
        "effective_from": "2027-01-01",
        "effective_until": None,
        "criteria_text": "TargetDrug RA v3 criteria.",
    },
    "active_v2": {
        **_BASE,
        "effective_from": "2025-06-01",
        "effective_until": "2027-01-01",
        "criteria_text": "TargetDrug RA v2 criteria.",
    },
}


@pytest.fixture
def multi_pack_registry(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = tmp_path / "multi_requirements.json"
    path.write_text(json.dumps({"packs": _MULTI_PACKS}), encoding="utf-8")
    monkeypatch.setattr(requirements_lookup, "_REQUIREMENTS_PATH", path)
    monkeypatch.setattr(
        requirements_lookup, "_BY_PLAN_ID", requirements_lookup._load_requirements()
    )


@pytest.fixture
def overlap_registry(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    packs = {
        **_MULTI_PACKS,
        "overlap_v2b": {
            **_MULTI_PACKS["active_v2"],
            "effective_from": "2026-01-01",
            "effective_until": "2026-12-31",
            "criteria_text": "TargetDrug RA overlapping criteria.",
        },
    }
    path = tmp_path / "overlap_requirements.json"
    path.write_text(json.dumps({"packs": packs}), encoding="utf-8")
    monkeypatch.setattr(requirements_lookup, "_REQUIREMENTS_PATH", path)
    monkeypatch.setattr(
        requirements_lookup, "_BY_PLAN_ID", requirements_lookup._load_requirements()
    )


@pytest.mark.usefixtures("multi_pack_registry")
def test_multi_pack_narrows_to_single_governing_pack_with_elimination_trace() -> None:
    trace = resolve_pack_with_trace(
        "MULTI-PLAN",
        "samplemab (TargetDrug) 40mg",
        diagnosis="Rheumatoid Arthritis (M05.79)",
        as_of=date(2026, 6, 1),
    )

    assert isinstance(trace, PolicyResolutionTrace)
    assert trace.resolution == "plan_id"
    assert trace.stage == "selected"
    assert trace.selected_pack_id == "active_v2"
    assert trace.criteria_text == "TargetDrug RA v2 criteria."
    assert trace.hold_reason is None
    assert trace.hold_message is None
    assert trace.total_candidates == 5
    assert len(trace.candidates) == 5

    assert all(isinstance(c, PolicyCandidateElimination) for c in trace.candidates)
    outcomes = {c.pack_id: (c.outcome, c.stage, c.reason) for c in trace.candidates}
    assert outcomes == {
        "wrong_drug": ("eliminated", "product", "product_mismatch"),
        "wrong_indication": ("eliminated", "indication", "indication_mismatch"),
        "expired_v1": ("eliminated", "effective_date", "no_effective_version"),
        "future_v3": ("eliminated", "effective_date", "no_effective_version"),
        "active_v2": ("selected", "selected", "matched"),
    }


def _elim(stage: str, reason: str) -> tuple[str, str, str]:
    return ("eliminated", stage, reason)


_HOLD_CASES = [
    (
        "UNKNOWN-PLAN",
        "TargetDrug (samplemab)",
        "M05.79",
        date(2026, 6, 1),
        "missing_policy",
        "plan_lookup",
        {},
    ),
    (
        "MULTI-PLAN",
        "UnrelatedDrug",
        "M05.79",
        date(2026, 6, 1),
        "product_mismatch",
        "product",
        {
            "wrong_drug": _elim("product", "product_mismatch"),
            "active_v2": _elim("product", "product_mismatch"),
        },
    ),
    (
        "MULTI-PLAN",
        "TargetDrug (samplemab)",
        "   ",
        date(2026, 6, 1),
        "missing_indication",
        "indication",
        {
            "wrong_drug": _elim("product", "product_mismatch"),
            "wrong_indication": _elim("indication", "missing_indication"),
            "active_v2": _elim("indication", "missing_indication"),
        },
    ),
    (
        "MULTI-PLAN",
        "TargetDrug (samplemab)",
        "G35",
        date(2026, 6, 1),
        "indication_mismatch",
        "indication",
        {
            "wrong_drug": _elim("product", "product_mismatch"),
            "wrong_indication": _elim("indication", "indication_mismatch"),
            "active_v2": _elim("indication", "indication_mismatch"),
        },
    ),
    (
        "MULTI-PLAN",
        "TargetDrug (samplemab)",
        "M05.79",
        None,
        "missing_effective_date",
        "effective_date",
        {
            "wrong_drug": _elim("product", "product_mismatch"),
            "wrong_indication": _elim("indication", "indication_mismatch"),
            "active_v2": _elim("effective_date", "missing_effective_date"),
        },
    ),
    (
        "MULTI-PLAN",
        "TargetDrug (samplemab)",
        "M05.79",
        date(2023, 12, 31),
        "no_effective_version",
        "effective_date",
        {
            "wrong_drug": _elim("product", "product_mismatch"),
            "wrong_indication": _elim("indication", "indication_mismatch"),
            "expired_v1": _elim("effective_date", "no_effective_version"),
            "active_v2": _elim("effective_date", "no_effective_version"),
        },
    ),
]


@pytest.mark.usefixtures("multi_pack_registry")
@pytest.mark.parametrize(
    ("plan_id", "drug", "diagnosis", "as_of", "hold_reason", "stage", "expected_outcomes"),
    _HOLD_CASES,
)
def test_fail_closed_holds_record_exact_stage_and_eliminations(
    plan_id: str,
    drug: str,
    diagnosis: str,
    as_of: date | None,
    hold_reason: str,
    stage: str,
    expected_outcomes: dict[str, tuple[str, str, str]],
) -> None:
    trace = resolve_pack_with_trace(plan_id, drug, diagnosis=diagnosis, as_of=as_of)

    assert trace.resolution == "generic"
    assert trace.stage == stage
    assert trace.hold_reason == hold_reason
    assert trace.hold_message is not None and hold_reason in trace.hold_message
    assert trace.pack is None
    assert trace.criteria_text is None
    assert trace.selected_pack_id is None

    by_id = {c.pack_id: c for c in trace.candidates}
    for pack_id, expected in expected_outcomes.items():
        row = by_id[pack_id]
        assert (row.outcome, row.stage, row.reason) == expected

    # Backwards compatibility with resolve_pack and resolve_requirements
    pack, res = resolve_pack(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    req, req_res = resolve_requirements(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    assert res == req_res == "generic"
    assert pack == req == trace.hold_message


@pytest.mark.usefixtures("overlap_registry")
def test_ambiguous_policy_hold_marks_competing_candidates() -> None:
    trace = resolve_pack_with_trace(
        "MULTI-PLAN",
        "TargetDrug (samplemab)",
        diagnosis="M05.79",
        as_of=date(2026, 6, 1),
    )

    assert trace.resolution == "generic"
    assert trace.stage == "uniqueness"
    assert trace.hold_reason == "ambiguous_policy"
    assert trace.hold_message is not None and "ambiguous_policy" in trace.hold_message
    assert trace.pack is None

    by_id = {c.pack_id: c for c in trace.candidates}
    assert (by_id["active_v2"].outcome, by_id["active_v2"].stage, by_id["active_v2"].reason) == (
        "ambiguous",
        "uniqueness",
        "ambiguous_policy",
    )
    assert (
        by_id["overlap_v2b"].outcome,
        by_id["overlap_v2b"].stage,
        by_id["overlap_v2b"].reason,
    ) == ("ambiguous", "uniqueness", "ambiguous_policy")
    assert by_id["wrong_drug"].outcome == "eliminated"


@pytest.mark.parametrize(
    ("plan_id", "drug", "diagnosis", "as_of"),
    [
        ("CIGNA-CNF360-2024", "Ozempic (semaglutide)", "E11.9", date(2026, 11, 19)),
        ("UHC-CHOICE-2026", "Nexium oral suspension", "K21.0", date(2026, 10, 23)),
        ("CIGNA-CNF877-2024", "Livdelzi (seladelpar)", "K74.3", date(2026, 11, 19)),
        ("CIGNA-IP0652-2026", "Humira (adalimumab)", "M05.79", date(2026, 11, 19)),
        ("CIGNA-CNF360-2024", "Wegovy", "E11.9", date(2026, 11, 19)),
    ],
)
def test_trace_matches_resolve_pack_and_resolve_requirements(
    plan_id: str, drug: str, diagnosis: str, as_of: date | None
) -> None:
    trace = resolve_pack_with_trace(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    pack, res = resolve_pack(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    criteria, req_res = resolve_requirements(plan_id, drug, diagnosis=diagnosis, as_of=as_of)

    assert trace.resolution == res == req_res
    if trace.resolution == "plan_id":
        assert pack == trace.pack
        assert criteria == trace.criteria_text
    else:
        assert pack == criteria == trace.hold_message
