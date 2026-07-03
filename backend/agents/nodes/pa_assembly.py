"""agents/nodes/pa_assembly.py — Assemble the canonical structured PA request.

Node contract: (InitialPaState) -> InitialPaState
Pure function — no side effects, no I/O.

Produces the canonical PaSubmission; the PAS/X12-278 rail shape is the rail
adapter's job (Slice 3 — adapter pattern: canonical in, rail shape out).
"""

from __future__ import annotations

from models.schemas import InitialPaRequest, InitialPaState, PaSubmission


def build_submission(request: InitialPaRequest, pa_context: str) -> PaSubmission:
    """Pure assembly rule: request facts + CRD-resolved criteria → PaSubmission.

    Args:
        request: The validated initial-PA request.
        pa_context: Payer criteria text resolved by the CRD check.

    Returns:
        The canonical structured PA submission.
    """
    return PaSubmission(
        case_ref=request.case_ref,
        scenario_id=request.scenario_id,
        drug=request.drug,
        diagnosis=request.diagnosis,
        plan_id=request.plan_id,
        requested_therapy=request.requested_therapy,
        criteria_evidence=list(request.criteria_results),
        pa_context=pa_context,
    )


def run_pa_assembly(state: InitialPaState) -> InitialPaState:
    """Assemble the structured PA request from state.

    Args:
        state: Initial-PA state after the CRD check.

    Returns:
        Updated state with ``submission`` populated. Input state is not mutated.
    """
    submission = build_submission(state["request"], state["pa_context"])
    return {**state, "submission": submission}
