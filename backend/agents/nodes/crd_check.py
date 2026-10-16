"""agents/nodes/crd_check.py — CRD pre-check: is a PA required for drug × plan?

Node contract: (InitialPaState) -> InitialPaState
Pure function — the registry lookup's file I/O happens once at module load
(agents/requirements_lookup.py).

Stub semantics: the pa_requirements registry stands in for the payer's CRD
endpoint (Da Vinci CRD in production). A plan_id hit means a PA requirement
is on file for this plan. Anything else is unknown (``required=None``): a
registry miss is not evidence that no PA is needed (ADR-0018), and a
drug-alias hit (the drug has a pack under another plan) says nothing about
this plan (ADR-0019). On unknown the pipeline exits before assembly, submits
nothing, and the case goes to a person (PRD slice 4 §5.3 as amended). The registry never says "PA not required" —
only a real payer CRD answer can; a payer CRD query replaces this lookup.
"""

from __future__ import annotations

from agents.requirements_lookup import resolve_requirements
from models.schemas import InitialPaState, PaRequired, PaResolution


def derive_pa_required(resolution: PaResolution, drug: str, plan_id: str) -> PaRequired:
    """Pure CRD rule: map a registry resolution path to a PaRequired verdict.

    Args:
        resolution: Which lookup path fired ("plan_id" | "drug_alias" | "generic").
        drug: Drug name as requested.
        plan_id: Payer plan identifier.

    Returns:
        PaRequired with a human-readable basis naming how the verdict was
        reached. A registry miss gives ``required=None`` (unknown — a person
        decides), never ``False``.
    """
    if resolution == "plan_id":
        return PaRequired(
            required=True,
            basis=f"Payer PA policy on file for plan {plan_id} covering {drug}.",
        )
    if resolution == "drug_alias":
        return PaRequired(
            required=None,
            basis=(
                f"Unknown — needs review by a person: plan {plan_id} is not in the "
                f"registry. {drug} has a policy on file for another plan only, and "
                "another plan's requirement is not used."
            ),
        )
    return PaRequired(
        required=None,
        basis=(
            f"Unknown — needs review by a person: nothing on file for {drug} × "
            f"{plan_id}, so whether a PA is required isn't known (registry lookup — "
            "stub CRD; production queries the payer's CRD endpoint)."
        ),
    )


def run_crd_check(state: InitialPaState) -> InitialPaState:
    """Resolve PA requirements and record whether a PA is required.

    Args:
        state: Initial-PA state with a validated request.

    Returns:
        Updated state with ``pa_required``, ``pa_context`` and
        ``pa_resolution`` populated. Input state is not mutated.
    """
    request = state["request"]
    pa_context, pa_resolution = resolve_requirements(request.plan_id, request.drug)
    pa_required = derive_pa_required(pa_resolution, request.drug, request.plan_id)
    return {
        **state,
        "pa_required": pa_required,
        "pa_context": pa_context,
        "pa_resolution": pa_resolution,
    }
