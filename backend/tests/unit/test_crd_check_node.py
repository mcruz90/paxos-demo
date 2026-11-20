"""Unit tests for the initial-PA policy check."""

from __future__ import annotations

from typing import Any

from agents.nodes.crd_check import run_crd_check
from agents.nodes.pa_ingestion import run_pa_ingestion
from models.schemas import InitialPaRequest


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
    assert "missing_policy" in updated["pa_required"].basis
    assert updated["pa_context"] == ""
    assert updated["pa_resolution"] == "generic"


def test_crd_check_state_purity() -> None:
    state = run_pa_ingestion(_request())
    _ = run_crd_check(state)
    assert state["pa_required"] is None
    assert state["pa_context"] == ""
