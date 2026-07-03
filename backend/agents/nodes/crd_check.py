"""agents/nodes/crd_check.py — CRD pre-check: is a PA required for drug × plan?

Node contract: (InitialPaState) -> InitialPaState
Pure function — the registry lookup's file I/O happens once at module load
(agents/requirements_lookup.py).

Stub semantics: the pa_requirements registry stands in for the payer's CRD
endpoint (Da Vinci CRD in production). A plan_id or drug-alias hit means a PA
requirement is on file; a registry miss means none is on file and the
pipeline early-exits ("PA not required" conditional edge). Note the stub
fails open on registry gaps — a drug missing from the registry reads as "no
PA required" — which is acceptable only while the registry is the
authoritative source; a real payer CRD query replaces this lookup.
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
        reached.
    """
    if resolution == "plan_id":
        return PaRequired(
            required=True,
            basis=f"Payer PA policy on file for plan {plan_id} covering {drug}.",
        )
    if resolution == "drug_alias":
        return PaRequired(
            required=True,
            basis=(
                f"PA requirement on file for {drug} (resolved by drug alias; "
                f"plan {plan_id} not in registry)."
            ),
        )
    return PaRequired(
        required=False,
        basis=(
            f"No PA requirement on file for {drug} × {plan_id} "
            "(registry lookup — stub CRD; production queries the payer's CRD endpoint)."
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
