"""agents/nodes/retrieval.py — PA requirement lookup node (appeal pipeline).

Node contract: (PipelineState) -> PipelineState
Pure function — no DB calls, no LLM calls.

The registry lookup itself lives in agents/requirements_lookup.py (extracted
S2 Slice 2 when the CRD-check node became its second consumer); this node
only maps it over the appeal PipelineState.
"""

from __future__ import annotations

from agents.requirements_lookup import resolve_requirements
from models.schemas import PipelineState


def run_retrieval(state: PipelineState) -> PipelineState:
    """Look up PA requirements and populate *pa_context*.

    Resolution order: exact plan_id → drug alias substring → generic fallback.
    Never raises; always returns a non-empty pa_context string.

    Args:
        state: Current pipeline state with an initialized AppealRequest.

    Returns:
        Updated state with ``pa_context`` populated. Input state is not mutated.
    """
    pa_context, pa_resolution = resolve_requirements(
        state["request"].plan_id, state["request"].drug
    )
    return {**state, "pa_context": pa_context, "pa_resolution": pa_resolution}
