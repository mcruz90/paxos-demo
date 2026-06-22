"""evals/appeal_evals.py — Deterministic structural scoring for generated appeal letters.

All scoring functions are pure Python — no LLM calls, no external I/O.
These scores are emitted in the DoneEvent and used by the pipeline's
retry logic is driven by the gatekeeper, not by evals.

Scoring dimensions (each returns 0.0 or 1.0):
  - drug_name_present:   drug name appears in the letter
  - diagnosis_present:   diagnosis appears in the letter
  - denial_addressed:    denial reason is mentioned
  - criteria_cited:      at least one criterion label from the scenario is cited
  - min_length:          letter is at least 300 characters
"""

from __future__ import annotations

from models.schemas import AppealRequest, ScenarioConfig

# Both ScenarioConfig and AppealRequest share the fields we need:
# drug, diagnosis, denial_reason, criteria_results.
_EvalContext = ScenarioConfig | AppealRequest

_MIN_LENGTH = 300


def eval_structural(text: str, scenario: ScenarioConfig | AppealRequest) -> dict[str, float]:
    """Score *text* on five deterministic structural dimensions.

    Args:
        text:     The generated appeal letter text.
        scenario: A :class:`ScenarioConfig` or :class:`AppealRequest` — both
                  share the fields needed for scoring (drug, diagnosis,
                  denial_reason, criteria_results).

    Returns:
        A dict with exactly these keys, each with a value of 0.0 or 1.0:
        ``drug_name_present``, ``diagnosis_present``, ``denial_addressed``,
        ``criteria_cited``, ``min_length``.
    """
    text_lower = text.lower()

    # --- drug_name_present ---
    drug_tokens = [t.lower().strip("()") for t in scenario.drug.split() if len(t) > 2]
    drug_present = any(token in text_lower for token in drug_tokens)

    # --- diagnosis_present ---
    diagnosis_tokens = [
        t.lower() for t in scenario.diagnosis.split() if len(t) > 3
    ]
    diagnosis_present = any(token in text_lower for token in diagnosis_tokens)

    # --- denial_addressed ---
    denial_tokens = [
        t.lower() for t in scenario.denial_reason.split() if len(t) > 3
    ]
    denial_addressed = any(token in text_lower for token in denial_tokens)

    # --- criteria_cited ---
    criteria_cited = False
    for cr in scenario.criteria_results:
        label_tokens = [t.lower() for t in cr.rule.label.split() if len(t) > 3]
        if any(token in text_lower for token in label_tokens):
            criteria_cited = True
            break

    # --- min_length ---
    min_length = len(text) >= _MIN_LENGTH

    return {
        "drug_name_present": 1.0 if drug_present else 0.0,
        "diagnosis_present": 1.0 if diagnosis_present else 0.0,
        "denial_addressed": 1.0 if denial_addressed else 0.0,
        "criteria_cited": 1.0 if criteria_cited else 0.0,
        "min_length": 1.0 if min_length else 0.0,
    }
