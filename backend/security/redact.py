"""PHI redaction — scrub patient-identifiable fields before logging or tracing.

Called before any text that touched a denial letter or patient record
is passed to Langfuse, stdout, or any external sink.
"""

from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Regex patterns — order matters: more specific before more general
# ---------------------------------------------------------------------------

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # SSN: 123-45-6789
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[REDACTED]"),
    # MRN: PH-1234 (project-specific format)
    (re.compile(r"\bPH-\d+\b"), "[REDACTED]"),
    # Date of birth: MM/DD/YYYY
    (re.compile(r"\b\d{1,2}/\d{1,2}/\d{4}\b"), "[REDACTED]"),
    # Two-word proper names: "Firstname Lastname" (both Title Case, letters only).
    # This pattern is intentionally conservative — drug names and ICD codes
    # won't match because they contain digits, parens, or are single tokens.
    (
        re.compile(r"\b([A-Z][a-z]{1,20})\s([A-Z][a-z]{1,20})\b"),
        "[REDACTED]",
    ),
]


def redact_phi(text: str) -> str:
    """Return *text* with PHI fields replaced by ``[REDACTED]``.

    Deterministic regex scrub — does NOT use an LLM or NLP library.
    Safe for use in log pipelines and Langfuse trace payloads.

    Clinical tokens (drug names, ICD codes, denial phrases) survive
    redaction because none of the patterns match them.
    """
    if not text:
        return text
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text
