"""Tests for the provider-neutral LLM backend seam (ml/llm_backend.py).

The provider is deliberately NOT decided — the Protocol is the contract the
pipeline codes against, and each provider (mock, groq, future ollama/openai/
anthropic) is one interchangeable implementation file behind it. Swapping or
adding a provider must never touch agents/ (CLAUDE.md Strategy-pattern rule).

Resilience requirements (CLAUDE.md "External APIs can be down"): explicit
timeout, bounded retries, and a short-circuit after repeated failures.
"""

from __future__ import annotations

import pytest

from errors import LLMUnavailableError
from ml.llm_backend import CircuitBreaker, LLMBackend
from ml.mock_backend import MockLLMBackend

# ---------------------------------------------------------------------------
# Protocol conformance
# ---------------------------------------------------------------------------


def test_mock_backend_satisfies_llm_backend_protocol() -> None:
    assert isinstance(MockLLMBackend(), LLMBackend)


def test_groq_backend_satisfies_llm_backend_protocol(monkeypatch) -> None:
    import groq

    monkeypatch.setattr(groq, "AsyncGroq", lambda **kwargs: object())
    from ml.groq_backend import GroqBackend

    assert isinstance(GroqBackend(api_key="test-key"), LLMBackend)


# ---------------------------------------------------------------------------
# Groq implementation — explicit timeout + bounded retries on the client
# ---------------------------------------------------------------------------


def test_groq_client_constructed_with_timeout_and_bounded_retries(monkeypatch) -> None:
    """The SDK client must be given an explicit timeout and a bounded retry
    count — never the hang-forever defaults (project-review-hardening item 8)."""
    import groq

    captured: dict = {}

    def _recorder(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(groq, "AsyncGroq", _recorder)
    from ml.groq_backend import GroqBackend

    GroqBackend(api_key="test-key")

    assert captured.get("timeout") is not None, "explicit timeout required"
    assert float(captured["timeout"]) > 0
    assert captured.get("max_retries") is not None, "bounded retry count required"
    assert int(captured["max_retries"]) >= 1


# ---------------------------------------------------------------------------
# Circuit breaker — short-circuit after repeated failures
# ---------------------------------------------------------------------------


class _FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_breaker_opens_after_threshold_failures() -> None:
    clock = _FakeClock()
    breaker = CircuitBreaker(failure_threshold=3, cooldown_seconds=30.0, clock=clock)

    for _ in range(3):
        breaker.check()
        breaker.record_failure()

    with pytest.raises(LLMUnavailableError):
        breaker.check()


def test_breaker_closes_again_after_cooldown() -> None:
    clock = _FakeClock()
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=30.0, clock=clock)

    breaker.record_failure()
    breaker.record_failure()
    with pytest.raises(LLMUnavailableError):
        breaker.check()

    clock.now = 31.0
    breaker.check()  # must not raise after cooldown


def test_breaker_success_resets_failure_count() -> None:
    clock = _FakeClock()
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=30.0, clock=clock)

    breaker.record_failure()
    breaker.record_success()
    breaker.record_failure()
    breaker.check()  # 1 consecutive failure < threshold — must not raise


@pytest.mark.asyncio
async def test_groq_generate_short_circuits_when_breaker_open(monkeypatch) -> None:
    """After threshold consecutive failures, calls fail fast with
    LLMUnavailableError — the degraded dependency is not hammered."""
    import groq

    call_count = 0

    class _FailingCompletions:
        async def create(self, **kwargs):
            nonlocal call_count
            call_count += 1
            raise RuntimeError("provider down")

    class _FakeClient:
        def __init__(self) -> None:
            self.chat = type("Chat", (), {"completions": _FailingCompletions()})()

    monkeypatch.setattr(groq, "AsyncGroq", lambda **kwargs: _FakeClient())
    from ml.groq_backend import GroqBackend

    clock = _FakeClock()
    backend = GroqBackend(
        api_key="test-key",
        breaker=CircuitBreaker(failure_threshold=3, cooldown_seconds=30.0, clock=clock),
    )

    for _ in range(3):
        with pytest.raises(RuntimeError):
            await backend.generate("prompt")

    with pytest.raises(LLMUnavailableError):
        await backend.generate("prompt")
    assert call_count == 3, "breaker must prevent the 4th call from reaching the provider"


# ---------------------------------------------------------------------------
# Factory — provider selected by env var; no implicit provider commitment
# ---------------------------------------------------------------------------


def test_factory_returns_mock_backend(monkeypatch) -> None:
    monkeypatch.setenv("LLM_BACKEND", "mock")
    from main import _build_llm_backend

    assert isinstance(_build_llm_backend(), MockLLMBackend)


def test_factory_rejects_unknown_backend(monkeypatch) -> None:
    monkeypatch.setenv("LLM_BACKEND", "notaprovider")
    from main import _build_llm_backend

    with pytest.raises(ValueError, match="notaprovider"):
        _build_llm_backend()


def test_factory_requires_explicit_backend_selection(monkeypatch) -> None:
    """No silent default provider — the provider decision is deliberately open,
    so an unset LLM_BACKEND must fail fast with the available options."""
    monkeypatch.delenv("LLM_BACKEND", raising=False)
    from main import _build_llm_backend

    with pytest.raises(ValueError, match="LLM_BACKEND"):
        _build_llm_backend()
