"""ml/llm_backend.py — provider-neutral LLM backend contract + shared resilience.

The LLM provider is deliberately NOT decided. This Protocol is the contract
the pipeline codes against; each provider (mock, groq, and future ollama /
openai / anthropic implementations) is one interchangeable file in ml/ behind
it. Adding a provider = one new module + one factory entry in main.py — zero
changes to agents/ (CLAUDE.md Strategy-pattern rule).

CircuitBreaker is the shared short-circuit primitive every remote provider
implementation should use (CLAUDE.md: "External APIs can be down" — never
hammer a degraded dependency).
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Callable
from typing import Protocol, runtime_checkable

from errors import LLMUnavailableError


@runtime_checkable
class LLMBackend(Protocol):
    """Contract every LLM provider implementation must satisfy."""

    model_name: str

    def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        """Yield response text chunks as they arrive."""
        ...

    async def generate(self, prompt: str) -> str:
        """Return the full response text in one call."""
        ...


class CircuitBreaker:
    """Short-circuit after repeated consecutive failures.

    After ``failure_threshold`` consecutive failures the breaker opens:
    ``check()`` raises :class:`LLMUnavailableError` immediately instead of
    letting calls reach the degraded provider. After ``cooldown_seconds`` the
    breaker closes again and the next call goes through as a probe.

    The clock is injectable for deterministic tests.
    """

    def __init__(
        self,
        failure_threshold: int = 3,
        cooldown_seconds: float = 30.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._threshold = failure_threshold
        self._cooldown = cooldown_seconds
        self._clock = clock
        self._consecutive_failures = 0
        self._opened_at: float | None = None

    def check(self) -> None:
        """Raise LLMUnavailableError if the breaker is open (fail fast)."""
        if self._opened_at is None:
            return
        if self._clock() - self._opened_at >= self._cooldown:
            # Cooldown elapsed — close and allow a probe call through.
            self._opened_at = None
            self._consecutive_failures = 0
            return
        raise LLMUnavailableError(
            f"LLM provider short-circuited after {self._threshold} consecutive "
            f"failures; retrying after {self._cooldown:.0f}s cooldown."
        )

    def record_failure(self) -> None:
        self._consecutive_failures += 1
        if self._consecutive_failures >= self._threshold:
            self._opened_at = self._clock()

    def record_success(self) -> None:
        self._consecutive_failures = 0
        self._opened_at = None
