"""agents/nodes/gatekeeper.py — Deterministic appeal letter quality gate.

Node contract: (PipelineState) -> PipelineState
Pure function — no LLM calls. All checks are deterministic regex/string ops.

Fails fast if the generated appeal text does not meet minimum structural
requirements. The pipeline retries synthesis up to MAX_RETRIES times before
emitting an ErrorEvent.
"""

from __future__ import annotations

import re

from models.schemas import PipelineState

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MIN_LENGTH = 300  # characters

# Phrases that indicate the LLM refused or leaked its identity
_REFUSAL_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"i cannot assist", re.IGNORECASE),
    re.compile(r"as an ai (language model|assistant)", re.IGNORECASE),
    re.compile(r"as an ai,", re.IGNORECASE),
    re.compile(r"i('m| am) not able to", re.IGNORECASE),
    re.compile(r"i('m| am) unable to", re.IGNORECASE),
    re.compile(r"i cannot provide", re.IGNORECASE),
    re.compile(r"i do not have the ability", re.IGNORECASE),
]


def run_gatekeeper(state: PipelineState) -> PipelineState:
    """Validate *state[\"appeal_text\"]* against structural quality criteria.

    Checks (in order):
    1. Minimum length (≥ 300 characters).
    2. Drug name present (case-insensitive substring).
    3. Diagnosis present (case-insensitive substring).
    4. No refusal/AI-identity phrases.

    Sets ``passed_gatekeeper=True`` only when all checks pass.
    Appends a descriptive error message for each failed check.

    Args:
        state: Pipeline state with ``appeal_text`` populated by the synthesis node.

    Returns:
        Updated state with ``passed_gatekeeper`` and ``errors`` set.
    """
    text = state["appeal_text"]
    request = state["request"]
    errors: list[str] = list(state.get("errors") or [])

    # --- Check 1: minimum length ---
    if len(text) < MIN_LENGTH:
        errors.append(
            f"Appeal text too short: {len(text)} chars (minimum {MIN_LENGTH})."
        )
        return {**state, "passed_gatekeeper": False, "errors": errors}

    # --- Check 2: drug name present ---
    drug_lower = request.drug.lower()
    # Also check the first word of a compound name (e.g. "Ozempic" from "Ozempic (semaglutide)")
    drug_tokens = [t.lower().strip("()") for t in request.drug.split() if len(t) > 3]
    if not any(token in text.lower() for token in [drug_lower] + drug_tokens):
        errors.append(f"Drug name '{request.drug}' not found in appeal text.")
        return {**state, "passed_gatekeeper": False, "errors": errors}

    # --- Check 3: diagnosis present ---
    diagnosis_lower = request.diagnosis.lower()
    # Check primary tokens of the diagnosis (skip short stop words)
    diagnosis_tokens = [
        t.lower() for t in request.diagnosis.split() if len(t) > 3
    ]
    if not any(token in text.lower() for token in [diagnosis_lower] + diagnosis_tokens):
        errors.append(f"Diagnosis '{request.diagnosis}' not found in appeal text.")
        return {**state, "passed_gatekeeper": False, "errors": errors}

    # --- Check 4: no refusal/AI-identity phrases ---
    for pattern in _REFUSAL_PATTERNS:
        if pattern.search(text):
            errors.append(
                f"Refusal or AI-identity phrase detected: '{pattern.pattern}'."
            )
            return {**state, "passed_gatekeeper": False, "errors": errors}

    return {**state, "passed_gatekeeper": True, "errors": errors}
