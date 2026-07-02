"""ml/mock_backend.py — Deterministic mock LLM backend for CI and local dev.

Used when LLM_BACKEND=mock is set in the environment. Renders an appeal
letter from the Drug:/Diagnosis: lines of the prompt itself, so the output
passes the gatekeeper's drug/diagnosis checks for ANY scenario — not just
Ozempic. No API keys or network access required.

This is a production module — not a test helper. Tests that need isolation
should use conftest.MockLLMBackend (same interface, separate instantiation).
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator

_DRUG_LINE_RE = re.compile(r"^Drug:\s*(.+)$", re.MULTILINE)
_DIAGNOSIS_LINE_RE = re.compile(r"^Diagnosis:\s*(.+)$", re.MULTILINE)

_MOCK_APPEAL_TEMPLATE = (
    "Dear Medical Director,\n\n"
    "We are writing to formally appeal the denial of prior authorization for "
    "{drug} for the treatment of {diagnosis}.\n\n"
    "The patient meets all clinical criteria per the payer's PA policy for "
    "{drug}. The cited denial reason does not reflect the documented clinical "
    "record: the diagnosis of {diagnosis} is established in the attached "
    "clinical notes, and the required prerequisite therapies and monitoring "
    "are documented therein.\n\n"
    "We request urgent reconsideration. Please contact our office with any "
    "additional information required.\n\nSincerely,\nClinical Team"
)


def _render_mock_appeal(prompt: str) -> str:
    """Fill the letter template with the drug/diagnosis named in the prompt."""
    drug_match = _DRUG_LINE_RE.search(prompt)
    diagnosis_match = _DIAGNOSIS_LINE_RE.search(prompt)
    drug = drug_match.group(1).strip() if drug_match else "the requested medication"
    diagnosis = diagnosis_match.group(1).strip() if diagnosis_match else "the documented condition"
    return _MOCK_APPEAL_TEMPLATE.format(drug=drug, diagnosis=diagnosis)


class MockLLMBackend:
    """Drop-in LLM backend that renders a deterministic appeal letter.

    Implements the same interface as the real backends in ml/ so the graph
    orchestrator can use either interchangeably via LLM_BACKEND.
    """

    model_name: str = "mock-llm"

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        """Yield the mock appeal text word by word."""
        for word in _render_mock_appeal(prompt).split(" "):
            yield word + " "

    async def generate(self, prompt: str) -> str:
        """Return the full mock appeal text in one call."""
        return _render_mock_appeal(prompt)
