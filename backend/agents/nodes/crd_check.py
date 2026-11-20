"""Check whether an applicable PA policy is on file for the initial request."""

from __future__ import annotations

from datetime import date

from agents.requirements_lookup import resolve_requirements
from models.schemas import InitialPaState, PaRequired


def run_crd_check(state: InitialPaState) -> InitialPaState:
    """Resolve payer criteria or send an unknown PA requirement to human review."""
    request = state["request"]
    context, resolution = resolve_requirements(
        request.plan_id, request.drug, diagnosis=request.diagnosis, as_of=date.today()
    )
    found = resolution == "plan_id"
    basis = (
        f"Payer PA policy on file for plan {request.plan_id} covering {request.drug}."
        if found
        else f"PA requirement unknown; needs review by a person. {context}"
    )
    return {
        **state,
        "pa_required": PaRequired(required=True if found else None, basis=basis),
        "pa_context": context if found else "",
        "pa_resolution": resolution,
    }
