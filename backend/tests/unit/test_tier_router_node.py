"""Unit tests for agents/nodes/tier_router.py — deterministic HITL tier routing (S3 Slice 2).

The tier decision is a regulatory + safety constraint (Illinois, MD HB 1563):
it must be pure and deterministic — never an LLM deciding tier. `decide_tier`
takes typed literals and returns a `CaseTier`; `run_tier_router` only maps it
over `PipelineState`.

Band spec (11-sprint-plan.md, S3 Slice 2):
- routine:   all confidences >= 0.95 AND first-pass gatekeeper
- complex:   any confidence in [0.70, 0.95), counter-offer, first drug/plan
             pairing (pa_resolution == "drug_alias"), or passed-after-retries
- exception: any confidence < 0.70 or missing, nothing assessed, gatekeeper
             exhausted (>= MAX_RETRIES), novel denial reason, or
             pa_resolution == "generic"

Run from backend/:
    uv run pytest tests/unit/test_tier_router_node.py -v
"""

from __future__ import annotations

from agents.nodes.ingestion import run_ingestion
from agents.nodes.tier_router import TierSignals, decide_tier, run_tier_router
from models.schemas import (
    AppealRequest,
    CaseTier,
    CriterionResult,
    CriterionStatus,
    Rule,
    RuleType,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _signals(
    confidences: tuple[float | None, ...] = (0.98, 0.97),
    gatekeeper_retries: int = 0,
    pa_resolution: str = "plan_id",
    counter_offer: bool = False,
    novel_denial_reason: bool = False,
) -> TierSignals:
    """A routine-eligible baseline; each test overrides one signal."""
    return TierSignals(
        confidences=confidences,
        gatekeeper_retries=gatekeeper_retries,
        pa_resolution=pa_resolution,  # type: ignore[arg-type]
        counter_offer=counter_offer,
        novel_denial_reason=novel_denial_reason,
    )


def _criterion(confidence: float | None) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="dx"),
        status=CriterionStatus.found,
        note="",
        confidence=confidence,
    )


def _request(confidences: list[float | None]) -> AppealRequest:
    return AppealRequest(
        scenario_id="tier-router-test",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text="Denied.",
        denial_reason="step therapy",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        criteria_results=[_criterion(c) for c in confidences],
    )


# ---------------------------------------------------------------------------
# decide_tier — routine band
# ---------------------------------------------------------------------------


def test_all_high_confidence_first_pass_is_routine() -> None:
    assert decide_tier(_signals()) == CaseTier.routine


def test_boundary_confidence_0_95_is_routine() -> None:
    """>= 0.95 is inside the routine band — the boundary is inclusive."""
    assert decide_tier(_signals(confidences=(0.95, 0.99))) == CaseTier.routine


# ---------------------------------------------------------------------------
# decide_tier — complex band
# ---------------------------------------------------------------------------


def test_mid_band_confidence_is_complex() -> None:
    assert decide_tier(_signals(confidences=(0.98, 0.80))) == CaseTier.complex


def test_boundary_confidence_0_70_is_complex() -> None:
    """Exactly 0.70 is the bottom of the complex band, not exception."""
    assert decide_tier(_signals(confidences=(0.70,))) == CaseTier.complex


def test_just_below_routine_boundary_is_complex() -> None:
    assert decide_tier(_signals(confidences=(0.9499,))) == CaseTier.complex


def test_counter_offer_is_complex() -> None:
    assert decide_tier(_signals(counter_offer=True)) == CaseTier.complex


def test_drug_alias_resolution_is_complex() -> None:
    """pa_resolution == 'drug_alias' means the drug is known but this exact
    plan pack is not — the deterministic form of 'first drug/plan pairing'."""
    assert decide_tier(_signals(pa_resolution="drug_alias")) == CaseTier.complex


def test_passed_after_retries_is_not_routine() -> None:
    """Routine requires a FIRST-PASS gatekeeper; a pass after 1-2 retries
    lands complex even with all-high confidences."""
    assert decide_tier(_signals(gatekeeper_retries=1)) == CaseTier.complex
    assert decide_tier(_signals(gatekeeper_retries=2)) == CaseTier.complex


# ---------------------------------------------------------------------------
# decide_tier — exception band
# ---------------------------------------------------------------------------


def test_low_confidence_is_exception() -> None:
    assert decide_tier(_signals(confidences=(0.98, 0.45))) == CaseTier.exception


def test_just_below_0_70_is_exception() -> None:
    assert decide_tier(_signals(confidences=(0.6999,))) == CaseTier.exception


def test_missing_confidence_is_exception() -> None:
    """None = 'not assessed' — an unassessed finding always routes to a human."""
    assert decide_tier(_signals(confidences=(0.98, None))) == CaseTier.exception


def test_no_criteria_assessed_is_exception() -> None:
    """No criteria at all = nothing assessed — fail-safe to exception,
    never routine-by-vacuous-truth."""
    assert decide_tier(_signals(confidences=())) == CaseTier.exception


def test_gatekeeper_exhausted_is_exception() -> None:
    assert decide_tier(_signals(gatekeeper_retries=3)) == CaseTier.exception


def test_novel_denial_reason_is_exception() -> None:
    assert decide_tier(_signals(novel_denial_reason=True)) == CaseTier.exception


def test_generic_pa_resolution_is_exception() -> None:
    """The hard-5 generic-fallback signal finally has its consumer: a
    generic-pack letter is never auto-routed past a human."""
    assert decide_tier(_signals(pa_resolution="generic")) == CaseTier.exception


# ---------------------------------------------------------------------------
# decide_tier — precedence and determinism
# ---------------------------------------------------------------------------


def test_exception_takes_precedence_over_complex() -> None:
    """When exception and complex triggers are both present, exception wins."""
    assert (
        decide_tier(
            _signals(
                confidences=(0.80, 0.50),  # 0.80 → complex, 0.50 → exception
                counter_offer=True,
                pa_resolution="generic",
            )
        )
        == CaseTier.exception
    )


def test_decision_is_deterministic() -> None:
    signals = _signals(confidences=(0.95, 0.80, 0.72))
    assert all(decide_tier(signals) == decide_tier(signals) for _ in range(3))


# ---------------------------------------------------------------------------
# run_tier_router — (state) -> state node contract
# ---------------------------------------------------------------------------


def test_node_sets_tier_on_state() -> None:
    state = run_ingestion(_request([0.98, 0.97]))
    state = {**state, "pa_resolution": "plan_id"}
    result = run_tier_router(state)
    assert result["tier"] == CaseTier.routine


def test_node_routes_golden_style_mid_band_to_complex() -> None:
    state = run_ingestion(_request([0.98, 0.74]))
    state = {**state, "pa_resolution": "plan_id"}
    assert run_tier_router(state)["tier"] == CaseTier.complex


def test_node_routes_unassessed_to_exception() -> None:
    state = run_ingestion(_request([None]))
    state = {**state, "pa_resolution": "plan_id"}
    assert run_tier_router(state)["tier"] == CaseTier.exception


def test_node_routes_generic_resolution_to_exception() -> None:
    state = run_ingestion(_request([0.98, 0.97]))
    state = {**state, "pa_resolution": "generic"}
    assert run_tier_router(state)["tier"] == CaseTier.exception


def test_node_respects_retry_count_from_state() -> None:
    state = run_ingestion(_request([0.98, 0.97]))
    state = {**state, "pa_resolution": "plan_id", "retry_count": 1}
    assert run_tier_router(state)["tier"] == CaseTier.complex


def test_node_does_not_mutate_input_state() -> None:
    state = run_ingestion(_request([0.98, 0.97]))
    state = {**state, "pa_resolution": "plan_id"}
    before = dict(state)
    run_tier_router(state)
    assert dict(state) == before


def test_ingestion_initializes_tier_to_none() -> None:
    """tier is None until the tier router runs — never a default tier."""
    state = run_ingestion(_request([0.98]))
    assert state["tier"] is None
