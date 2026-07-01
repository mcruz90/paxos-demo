"""Unit tests for agents/nodes/retrieval.py — PA lookup from pa_requirements.json."""

from __future__ import annotations

import pytest

from agents.nodes.retrieval import run_retrieval
from models.schemas import AppealRequest, CriterionResult, CriterionStatus, PipelineState, Rule, RuleType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _state(request: AppealRequest) -> PipelineState:
    return {
        "request": request,
        "pa_context": "",
        "appeal_text": "",
        "model_name": "",
        "passed_gatekeeper": False,
        "retry_count": 0,
        "errors": [],
    }


def _ozempic_cigna_request() -> AppealRequest:
    """Appeal request with the canonical Cigna Ozempic plan_id — should resolve to Cigna pack."""
    return AppealRequest(
        scenario_id="ozempic-cigna-clinical-pa",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text="Authorization for Ozempic has been denied.",
        denial_reason="indication not confirmed",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        criteria_results=[
            CriterionResult(
                rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
                status=CriterionStatus.found,
                note="E11.9 documented",
            )
        ],
    )


# ---------------------------------------------------------------------------
# Existing behaviour (preserved from Sprint 0) — using conftest base_appeal_request
# ---------------------------------------------------------------------------


def test_retrieval_populates_pa_context(base_appeal_request, mock_llm) -> None:
    """run_retrieval should set a non-empty pa_context string in the state."""
    updated = run_retrieval(_state(base_appeal_request))
    assert updated["pa_context"] != ""
    assert isinstance(updated["pa_context"], str)


def test_retrieval_contains_drug_name(base_appeal_request) -> None:
    """pa_context should reference the drug by key or INN name."""
    updated = run_retrieval(_state(base_appeal_request))
    ctx = updated["pa_context"].lower()
    assert "ozempic" in ctx or "semaglutide" in ctx


def test_retrieval_unknown_drug_returns_generic_context() -> None:
    """A drug that matches no pack key and no alias falls back to generic context."""
    req = AppealRequest(
        scenario_id="unknownia-xyzab",
        drug="Unknownia (xyzab)",
        diagnosis="Rare Syndrome X",
        denial_text="Authorization denied.",
        denial_reason="formulary not covered",
        plan="Some PPO",
        plan_id="SOME-PPO-2024",
        criteria_results=[],
    )
    updated = run_retrieval(_state(req))
    ctx = updated["pa_context"]
    assert isinstance(ctx, str)
    assert len(ctx) > 0
    # Generic fallback should NOT contain any pack-specific drug name
    assert "ozempic" not in ctx.lower()
    assert "livdelzi" not in ctx.lower()
    assert "esomeprazole" not in ctx.lower()


# ---------------------------------------------------------------------------
# NEW — plan_id resolution (Slice 3: pa_requirements.json lookup)
# ---------------------------------------------------------------------------


def test_retrieval_resolves_by_plan_id_cigna_ozempic() -> None:
    """plan_id CIGNA-CNF360-2024 must resolve to the Cigna cnf_360 Ozempic pack."""
    updated = run_retrieval(_state(_ozempic_cigna_request()))
    ctx = updated["pa_context"].lower()
    # Pack criteria text must mention the drug and payer
    assert "ozempic" in ctx or "semaglutide" in ctx
    assert "cigna" in ctx


def test_retrieval_resolves_by_plan_id_uhc_esomeprazole() -> None:
    """plan_id UHC-CHOICE-2024 must resolve to the UHC PPI step-therapy pack."""
    req = AppealRequest(
        scenario_id="esomeprazole-uhc-pediatric-clinical-pa",
        drug="Nexium for Oral Suspension (esomeprazole)",
        diagnosis="GERD with erosive esophagitis (K21.0)",
        denial_text="Authorization denied.",
        denial_reason="step therapy not met",
        plan="UnitedHealthcare Choice Plus",
        plan_id="UHC-CHOICE-2024",
        criteria_results=[],
    )
    updated = run_retrieval(_state(req))
    ctx = updated["pa_context"].lower()
    assert "esomeprazole" in ctx or "nexium" in ctx or "ppi" in ctx or "step" in ctx
    assert "uhc" in ctx or "unitedhealthcare" in ctx


def test_retrieval_resolves_by_plan_id_cigna_livdelzi() -> None:
    """plan_id CIGNA-CNF877-2024 must resolve to the Cigna cnf_877 Livdelzi pack."""
    req = AppealRequest(
        scenario_id="livdelzi-cigna-hepatology-clinical-pa",
        drug="Livdelzi (seladelpar)",
        diagnosis="Primary Biliary Cholangitis (K74.3)",
        denial_text="Authorization denied.",
        denial_reason="UDCA trial duration not met",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF877-2024",
        criteria_results=[],
    )
    updated = run_retrieval(_state(req))
    ctx = updated["pa_context"].lower()
    assert "livdelzi" in ctx or "seladelpar" in ctx or "pbc" in ctx


def test_retrieval_falls_back_to_drug_alias_when_plan_unknown() -> None:
    """When plan_id is unknown, retrieval falls back to drug substring match."""
    req = AppealRequest(
        scenario_id="ozempic-unknown-plan",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text="Authorization denied.",
        denial_reason="step therapy",
        plan="SomePPO",
        plan_id="UNKNOWN-PLAN-2099",
        criteria_results=[],
    )
    updated = run_retrieval(_state(req))
    ctx = updated["pa_context"].lower()
    # Should find the ozempic pack via drug alias fallback
    assert "ozempic" in ctx or "semaglutide" in ctx


def test_retrieval_state_purity() -> None:
    """run_retrieval must not mutate the input state — it returns a new dict."""
    req = _ozempic_cigna_request()
    original = _state(req)
    original_pa = original["pa_context"]
    _ = run_retrieval(original)
    assert original["pa_context"] == original_pa
