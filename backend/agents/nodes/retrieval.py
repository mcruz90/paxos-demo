"""agents/nodes/retrieval.py — PA requirement lookup.

Node contract: (PipelineState) -> PipelineState
Pure function — no DB calls, no LLM calls in Phase 0.

Phase 0 uses an in-memory fixture. Phase 1 will replace this with a
Qdrant vector store lookup once the ETL pipeline seeds the index.
"""

from __future__ import annotations

from models.schemas import PipelineState

# ---------------------------------------------------------------------------
# In-memory PA requirement fixtures (Phase 0 — no DB)
#
# Keyed by drug name fragment (lowercase) for flexible matching.
# Phase 1: replace with vector store retrieval seeded from
#   evals/fixtures/scenarios.json → data/pa_requirements.json
# ---------------------------------------------------------------------------

_PA_REQUIREMENTS: dict[str, str] = {
    "ozempic": (
        "PA Requirements — Ozempic (semaglutide) / BlueCross PPO:\n"
        "1. Confirmed diagnosis of Type 2 Diabetes Mellitus (ICD-10 E11.x).\n"
        "2. HbA1c ≥ 7.0% documented within the past 6 months.\n"
        "3. Step therapy: patient must have tried and failed at least two "
        "formulary alternatives (e.g. metformin, a sulfonylurea) with "
        "documented clinical records.\n"
        "4. Prescriber must be an endocrinologist or internal medicine physician.\n"
        "5. Quantity limit: 4 pens per 28 days."
    ),
    "semaglutide": (
        "PA Requirements — semaglutide (Ozempic/Wegovy) / BlueCross PPO:\n"
        "1. Confirmed T2DM diagnosis or BMI ≥ 30 for obesity indication.\n"
        "2. Step therapy required: documented failure of ≥2 formulary agents.\n"
        "3. Prescriber specialty: endocrinology or internal medicine."
    ),
}

_GENERIC_CONTEXT = (
    "PA Requirements — General:\n"
    "Prior authorization is required for this medication. "
    "Submit clinical documentation including diagnosis codes, "
    "failed alternative therapies, and prescriber specialty. "
    "Contact the plan's PA department for drug-specific criteria."
)


def run_retrieval(state: PipelineState) -> PipelineState:
    """Look up the PA requirements for the requested drug and populate *pa_context*.

    Matching is performed against the drug name in the request (case-insensitive
    substring search). Falls back to a generic context for unknown drugs —
    never raises.

    Args:
        state: Current pipeline state with an initialized :class:`AppealRequest`.

    Returns:
        Updated state with ``pa_context`` populated.
    """
    drug_lower = state["request"].drug.lower()

    pa_context = _GENERIC_CONTEXT
    for key, requirements in _PA_REQUIREMENTS.items():
        if key in drug_lower:
            pa_context = requirements
            break

    return {**state, "pa_context": pa_context}
