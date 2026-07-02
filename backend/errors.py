"""Shared typed exceptions — all domain errors must subclass these, never bare Exception."""

from __future__ import annotations


class ETLParseError(Exception):
    """Raised when ETL input cannot be parsed or validated."""


class GatekeeperError(Exception):
    """Raised when the gatekeeper node rejects an appeal after max retries."""


class ContextWindowError(Exception):
    """Raised when the LLM context window limit is exceeded."""


class RefusalDetectedError(Exception):
    """Raised when LLM output is detected as a refusal rather than an appeal."""


class LLMUnavailableError(Exception):
    """Raised when the LLM provider is short-circuited after repeated failures.

    Fail-fast signal: the circuit breaker is open, the degraded dependency is
    not being hammered, retry after the cooldown.
    """
