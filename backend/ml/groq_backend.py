"""ml/groq_backend.py — Groq implementation of the LLMBackend Protocol.

One provider among several, NOT the chosen one — the provider decision is
deliberately open. This module exists so the Groq option carries the required
resilience defaults (CLAUDE.md "External APIs can be down"):

  - explicit request timeout (never the SDK's hang-forever default)
  - bounded retries with the SDK's built-in exponential backoff
  - CircuitBreaker short-circuit after repeated consecutive failures

Selection happens in main.py's factory via LLM_BACKEND=groq.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import groq

from ml.llm_backend import CircuitBreaker

_DEFAULT_TIMEOUT_SECONDS = 30.0
_DEFAULT_MAX_RETRIES = 2  # SDK retries with exponential backoff


class GroqBackend:
    """LLMBackend implementation backed by the Groq chat-completions API."""

    model_name: str

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        timeout: float | None = None,
        max_retries: int | None = None,
        breaker: CircuitBreaker | None = None,
    ) -> None:
        self.model_name = model or os.environ.get("GROQ_MODEL", "llama3-8b-8192")
        self._breaker = breaker or CircuitBreaker()
        self._client = groq.AsyncGroq(
            api_key=api_key,
            timeout=(
                timeout
                if timeout is not None
                else float(os.environ.get("LLM_TIMEOUT_SECONDS", _DEFAULT_TIMEOUT_SECONDS))
            ),
            max_retries=max_retries if max_retries is not None else _DEFAULT_MAX_RETRIES,
        )

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        self._breaker.check()
        try:
            stream = await self._client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model_name,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield delta
        except Exception:
            self._breaker.record_failure()
            raise
        self._breaker.record_success()

    async def generate(self, prompt: str) -> str:
        self._breaker.check()
        try:
            response = await self._client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=self.model_name,
                stream=False,
            )
        except Exception:
            self._breaker.record_failure()
            raise
        self._breaker.record_success()
        return response.choices[0].message.content or ""
