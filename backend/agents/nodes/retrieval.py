"""Populate appeal state with payer criteria or a policy hold."""

from __future__ import annotations

from datetime import date

from agents.requirements_lookup import resolve_requirements
from models.schemas import PipelineState


def run_retrieval(state: PipelineState) -> PipelineState:
    request = state["request"]
    context, resolution = resolve_requirements(
        request.plan_id, request.drug, diagnosis=request.diagnosis, as_of=date.today()
    )
    found = resolution == "plan_id"
    return {
        **state,
        "pa_context": context if found else "",
        "pa_resolution": resolution,
        "policy_hold": "" if found else context,
    }
