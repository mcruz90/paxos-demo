"""agents/nodes/synthesis.py — LLM appeal generation node.

Node contract: build_prompt(state) -> prompt; apply_synthesis(state, text,
model) -> state. The graph orchestrator streams tokens (it must interleave
SSE ChunkEvents) and calls both — all synthesis logic lives here, none in
the graph.

Security: untrusted text (denial_text, pa_context) is always wrapped in
XML delimiters inside the prompt — never string-interpolated raw.
"""

from __future__ import annotations

from agents.prompts import APPEAL_PROMPT_TEMPLATE, APPEAL_SYSTEM_INSTRUCTIONS
from models.schemas import PipelineState

# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def build_prompt(state: PipelineState) -> str:
    """Construct the LLM prompt for appeal generation.

    Untrusted content (denial_text, pa_context) is enclosed in XML tags to
    prevent prompt injection — the model sees them as data, not instructions.
    Prompt copy lives in agents/prompts.py; this node only fills the slots.

    Args:
        state: Pipeline state after ingestion and retrieval nodes.

    Returns:
        A fully-formatted prompt string ready for the LLM backend.
    """
    request = state["request"]

    return APPEAL_PROMPT_TEMPLATE.format(
        system_instructions=APPEAL_SYSTEM_INSTRUCTIONS,
        drug=request.drug,
        diagnosis=request.diagnosis,
        plan=request.plan,
        pa_context=state["pa_context"],
        denial_text=request.denial_text,
    )


# ---------------------------------------------------------------------------
# State update
# ---------------------------------------------------------------------------


def apply_synthesis(
    state: PipelineState, appeal_text: str, model_name: str
) -> PipelineState:
    """Pure state updater: record the generated appeal text and model name.

    The graph orchestrator owns the streaming loop (it must interleave SSE
    ChunkEvents with token arrival); this function owns what "synthesis
    completed" means for state, so the node logic has exactly one home and
    the tested path is the production path.

    Args:
        state: Pipeline state after retrieval.
        appeal_text: The fully-collected LLM output.
        model_name: The backend's model identifier.

    Returns:
        Updated state. Input state is not mutated.
    """
    return {
        **state,
        "appeal_text": appeal_text,
        "model_name": model_name,
    }
