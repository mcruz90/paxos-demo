"""agents/nodes/synthesis.py — LLM appeal generation node.

Node contract: (PipelineState, llm_backend) -> PipelineState
The llm_backend is dependency-injected so tests can pass MockLLMBackend.

Security: untrusted text (denial_text, pa_context) is always wrapped in
XML delimiters inside the prompt — never string-interpolated raw.
"""

from __future__ import annotations

from models.schemas import PipelineState

# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTIONS = (
    "You are a clinical appeals specialist writing a formal prior authorization "
    "appeal letter on behalf of a prescribing physician. "
    "The letter must be professional, evidence-based, and cite the specific "
    "clinical criteria from the payer's PA policy. "
    "Do not introduce yourself as an AI. Write the letter directly."
)


def build_prompt(state: PipelineState) -> str:
    """Construct the LLM prompt for appeal generation.

    Untrusted content (denial_text, pa_context) is enclosed in XML tags to
    prevent prompt injection — the model sees them as data, not instructions.

    Args:
        state: Pipeline state after ingestion and retrieval nodes.

    Returns:
        A fully-formatted prompt string ready for the LLM backend.
    """
    request = state["request"]
    pa_context = state["pa_context"]

    return (
        f"{_SYSTEM_INSTRUCTIONS}\n\n"
        f"Drug: {request.drug}\n"
        f"Diagnosis: {request.diagnosis}\n"
        f"Plan: {request.plan}\n\n"
        f"<pa_requirements>\n{pa_context}\n</pa_requirements>\n\n"
        f"<denial_letter>\n{request.denial_text}\n</denial_letter>\n\n"
        "Write a formal prior authorization appeal letter addressing the denial reason. "
        "Cite the clinical evidence and PA criteria directly. "
        "Begin the letter with 'Dear Medical Director,'"
    )


# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------


async def run_synthesis(state: PipelineState, llm_backend) -> PipelineState:
    """Generate the appeal text using *llm_backend*.

    Calls ``llm_backend.generate(prompt)`` (non-streaming) and stores the
    result in ``state["appeal_text"]``. The gatekeeper node evaluates the
    result after this node completes.

    Args:
        state: Pipeline state after retrieval.
        llm_backend: Any object implementing ``generate(prompt: str) -> str``
            and ``model_name: str``. Injected by the graph orchestrator.

    Returns:
        Updated state with ``appeal_text`` and ``model_name`` populated.
    """
    prompt = build_prompt(state)
    appeal_text = await llm_backend.generate(prompt)
    return {
        **state,
        "appeal_text": appeal_text,
        "model_name": llm_backend.model_name,
    }
