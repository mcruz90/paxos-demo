"""agents/nodes/tier_router.py — Deterministic HITL tier routing (S3 Slice 2).

Node contract: (PipelineState) -> PipelineState
Pure function — no LLM calls, no I/O. **Never an LLM deciding tier**: the
review tier is a regulatory + safety constraint (Illinois, MD HB 1563), so
the decision is rule logic over typed signals, reproducible from the audit
trail.

`run_tier_router` only unpacks state into `TierSignals` and repacks the
result; `decide_tier` is the independently testable rule.
"""

from __future__ import annotations

from dataclasses import dataclass

from agents.nodes.gatekeeper import MAX_RETRIES
from models.schemas import CaseTier, PaResolution, PipelineState

# Band boundaries (11-sprint-plan.md, S3 Slice 2). Inclusive at the bottom:
# exactly 0.95 is routine-eligible, exactly 0.70 is complex.
ROUTINE_MIN_CONFIDENCE = 0.95
COMPLEX_MIN_CONFIDENCE = 0.70


@dataclass(frozen=True)
class TierSignals:
    """The typed inputs the tier decision is a pure function of.

    ``counter_offer`` and ``novel_denial_reason`` have no upstream producer
    yet — the node passes their defaults; the rule already honors them so the
    policy is complete. For ``counter_offer`` that is a recorded decision,
    not a gap: the producer stays deliberately unbuilt until a real payer
    rail exists (P10 brief, May 2026-07-18 — the demo's round-2 flow is a
    manifest-labeled simulated unit, ADR-0016).
    """

    # One entry per criterion finding; None = that finding was not assessed.
    confidences: tuple[float | None, ...]
    gatekeeper_retries: int
    pa_resolution: PaResolution
    counter_offer: bool = False
    novel_denial_reason: bool = False


def decide_tier(signals: TierSignals) -> CaseTier:
    """Route a case to routine / complex / exception review.

    - exception: any finding unassessed or below the complex band, nothing
      assessed at all (no routine-by-vacuous-truth), gatekeeper exhausted,
      novel denial reason, or no policy on file for this plan
      (``pa_resolution`` "generic", or "drug_alias": the drug matched another
      plan's pack, whose criteria are not used — ADR-0019). A letter without
      this plan's policy is never auto-routed past a human.
    - complex: any finding mid-band, a payer counter-offer, or a gatekeeper
      pass that needed retries (routine requires a first-pass gatekeeper).
    - routine: everything else — all findings >= 0.95, first-pass, no flags.

    Exception takes precedence over complex.
    """
    if (
        not signals.confidences
        or any(c is None or c < COMPLEX_MIN_CONFIDENCE for c in signals.confidences)
        or signals.gatekeeper_retries >= MAX_RETRIES
        or signals.novel_denial_reason
        or signals.pa_resolution in ("generic", "drug_alias")
    ):
        return CaseTier.exception
    if (
        any(c < ROUTINE_MIN_CONFIDENCE for c in signals.confidences)  # type: ignore[operator]
        or signals.counter_offer
        or signals.gatekeeper_retries > 0
    ):
        return CaseTier.complex
    return CaseTier.routine


def run_tier_router(state: PipelineState) -> PipelineState:
    """Assign *tier* from the run's signals.

    Args:
        state: Pipeline state after retrieval and gatekeeper have run.

    Returns:
        Updated state with ``tier`` set. Input state is not mutated.
    """
    signals = TierSignals(
        confidences=tuple(
            cr.confidence for cr in state["request"].criteria_results
        ),
        gatekeeper_retries=state["retry_count"],
        pa_resolution=state["pa_resolution"],
    )
    return {**state, "tier": decide_tier(signals)}
