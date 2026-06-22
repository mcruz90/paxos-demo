"""ml/mock_backend.py — Deterministic mock LLM backend for CI and local dev.

Used when LLM_BACKEND=mock is set in the environment. Returns a hardcoded
appeal letter that is guaranteed to pass all gatekeeper checks, making it
safe to use in integration tests without any API keys or network access.

This is a production module — not a test helper. Tests that need isolation
should use conftest.MockLLMBackend (same interface, separate instantiation).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

_MOCK_APPEAL_TEXT = (
    "Dear Medical Director,\n\n"
    "We are writing to formally appeal the denial of prior authorization for "
    "Ozempic (semaglutide) for the treatment of Type 2 Diabetes Mellitus.\n\n"
    "The patient meets all clinical criteria per the payer's PA policy. "
    "The denial cited 'formulary alternatives available', however the patient "
    "has failed two formulary alternatives (metformin, glipizide) as documented "
    "in the attached clinical notes.\n\n"
    "We request urgent reconsideration. Please contact our office with any "
    "additional information required.\n\nSincerely,\nClinical Team"
)


class MockLLMBackend:
    """Drop-in LLM backend that returns a hardcoded appeal letter.

    Interface matches GroqBackend so the graph orchestrator can use either
    interchangeably via the LLM_BACKEND environment variable.
    """

    model_name: str = "mock-llm"

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        """Yield the mock appeal text word by word."""
        for word in _MOCK_APPEAL_TEXT.split(" "):
            yield word + " "

    async def generate(self, prompt: str) -> str:
        """Return the full mock appeal text in one call."""
        return _MOCK_APPEAL_TEXT
