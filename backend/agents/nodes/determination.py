"""agents/nodes/determination.py — Stub payer determination on a PAS submission.

Node contract: (InitialPaState) -> InitialPaState
Deterministic, evidence-based stub — no LLM, no network. A real payer
determination arrives asynchronously on the rail; this stub derives it from
the submitted evidence so the lifecycle's three branches (approved / pended
loop / denied → appeal handoff) are exercised end-to-end:

  - non-empty evidence, all ``found``       → approved
  - empty evidence or any ``needs_review``  → pended (info request); the
    stub assumes the request is answered, so re-determination after one
    pend cycle approves (bounded by MAX_PEND_CYCLES — the graph always
    terminates)
  - any ``conflict``                        → denied → AppealHandoff

The handoff is a pointer (scenario + case_ref) into the appeal lifecycle;
launching the appeal stays a separate human-gated request.
"""

from __future__ import annotations

from models.schemas import (
    AppealHandoff,
    CriterionResult,
    CriterionStatus,
    InitialPaState,
    PaDecision,
    PaOutcome,
)

MAX_PEND_CYCLES = 1


def derive_determination(
    criteria_evidence: list[CriterionResult],
    pend_cycles: int,
    submission_ref: str,
) -> PaOutcome:
    """Pure determination rule: submitted evidence → payer decision.

    Args:
        criteria_evidence: The evidence attached to the PAS submission.
        pend_cycles: How many pend/info-request cycles have completed.
        submission_ref: The rail submission reference (keys determination_id).

    Returns:
        The payer's determination as a PaOutcome.
    """
    statuses = {criterion.status for criterion in criteria_evidence}
    determination_id = f"DET-{submission_ref}-{pend_cycles + 1}"

    if CriterionStatus.conflict in statuses:
        return PaOutcome(
            decision=PaDecision.denied,
            determinationId=determination_id,
            timeToTherapy="—",
            note="Denied — conflicting documentation in submitted evidence.",
        )

    needs_more = not criteria_evidence or CriterionStatus.needs_review in statuses
    if needs_more and pend_cycles < MAX_PEND_CYCLES:
        return PaOutcome(
            decision=PaDecision.pended,
            determinationId=determination_id,
            timeToTherapy="—",
            note="Pended — payer requested additional documentation.",
        )

    note = "Approved — submitted evidence satisfies the payer's criteria."
    if pend_cycles:
        note = "Approved — documentation supplied after pend satisfied the payer's criteria."
    return PaOutcome(
        decision=PaDecision.approved,
        determinationId=determination_id,
        timeToTherapy="3 business days (stub rail)",
        note=note,
    )


def make_appeal_handoff(scenario_id: str, case_ref: str) -> AppealHandoff:
    """Build the denied→appeal pointer, continuing the case reference.

    Args:
        scenario_id: The initial-PA scenario the appeal continues.
        case_ref: Client case reference; falls back to scenario_id when empty.

    Returns:
        The AppealHandoff pointer.
    """
    return AppealHandoff(scenarioId=scenario_id, caseRef=case_ref or scenario_id)


def run_determination(state: InitialPaState) -> InitialPaState:
    """Record the payer determination for the current submission.

    Args:
        state: Initial-PA state with ``submission`` and ``submission_ref`` set.

    Returns:
        Updated state with ``outcome`` set; ``pend_cycles`` incremented when
        pended; ``appeal_handoff`` set when denied. Input state is not mutated.
    """
    submission = state["submission"]
    assert submission is not None  # pas_submit always runs before determination

    outcome = derive_determination(
        submission.criteria_evidence, state["pend_cycles"], state["submission_ref"]
    )

    new_state: InitialPaState = {**state, "outcome": outcome}
    if outcome.decision is PaDecision.pended:
        new_state = {**new_state, "pend_cycles": state["pend_cycles"] + 1}
    if outcome.decision is PaDecision.denied:
        request = state["request"]
        new_state = {
            **new_state,
            "appeal_handoff": make_appeal_handoff(request.scenario_id, request.case_ref),
        }
    return new_state
