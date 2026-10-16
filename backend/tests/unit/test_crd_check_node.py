"""Unit tests — agents/nodes/crd_check.py (S2 Slice 2).

CRD (Coverage Requirements Discovery) pre-check: is a PA required for this
drug × plan, and on what basis? Stub semantics: the pa_requirements registry
stands in for the payer's CRD endpoint — a plan_id/drug-alias hit means a PA
requirement is on file. A registry miss (generic resolution) means nothing is
known: the verdict is unknown (required=None) and a person decides — never
"PA not required" (clearauth-eval gap analysis; May, 2026-10-15).
"""

from __future__ import annotations

from typing import Any

from agents.nodes.crd_check import derive_pa_required, run_crd_check
from agents.nodes.pa_ingestion import run_pa_ingestion
from models.schemas import InitialPaRequest, PaRequired


def _request(**overrides: Any) -> InitialPaRequest:
    kwargs: dict[str, Any] = {
        "scenario_id": "novo-ozempic-initial",
        "case_ref": "PA-2026-0847",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic 0.5 mg subcutaneous weekly",
        "criteria_results": [],
    }
    kwargs.update(overrides)
    return InitialPaRequest(**kwargs)


# ---------------------------------------------------------------------------
# derive_pa_required — the pure, independently testable rule
# ---------------------------------------------------------------------------


def test_derive_pa_required_plan_id_hit() -> None:
    result = derive_pa_required("plan_id", "Ozempic (semaglutide)", "CIGNA-CNF360-2024")
    assert isinstance(result, PaRequired)
    assert result.required is True
    assert "CIGNA-CNF360-2024" in result.basis


def test_derive_pa_required_drug_alias_hit() -> None:
    result = derive_pa_required("drug_alias", "Ozempic (semaglutide)", "UNKNOWN-PLAN-2099")
    assert result.required is True
    assert "drug" in result.basis.lower()


def test_derive_pa_required_registry_miss_is_unknown_not_not_required() -> None:
    """Generic resolution = nothing on file, which is not evidence that no PA
    is required. The verdict is unknown and the basis sends it to a person."""
    result = derive_pa_required("generic", "Unknownia (xyzab)", "SOME-PPO-2024")
    assert result.required is None
    assert "needs review by a person" in result.basis.lower()
    assert "not required" not in result.basis.lower()


# ---------------------------------------------------------------------------
# run_crd_check — node over InitialPaState
# ---------------------------------------------------------------------------


def test_crd_check_populates_state_on_plan_id_hit() -> None:
    state = run_pa_ingestion(_request())
    updated = run_crd_check(state)
    assert updated["pa_required"] is not None
    assert updated["pa_required"].required is True
    assert updated["pa_resolution"] == "plan_id"
    assert updated["pa_context"] != ""


def test_crd_check_registry_miss_sets_unknown() -> None:
    state = run_pa_ingestion(
        _request(
            scenario_id="unknownia-initial",
            drug="Unknownia (xyzab)",
            diagnosis="Rare Syndrome X",
            plan="Some PPO",
            plan_id="SOME-PPO-2024",
            requested_therapy="Unknownia 10 mg daily",
        )
    )
    updated = run_crd_check(state)
    assert updated["pa_required"] is not None
    assert updated["pa_required"].required is None
    assert updated["pa_resolution"] == "generic"


def test_crd_check_state_purity() -> None:
    state = run_pa_ingestion(_request())
    _ = run_crd_check(state)
    assert state["pa_required"] is None
    assert state["pa_context"] == ""
