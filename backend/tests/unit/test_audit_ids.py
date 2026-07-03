"""Unit tests — audit/ids.py (S2 Slice 4).

Idempotency key = case_id + submission attempt, never wall-clock time
(CLAUDE.md §Observability & Reliability). Pre-DB, the correlation_id
deliberately coincides with the idempotency key: one ID names the logical
submission end-to-end, and a transport retry (client timeout, SSE reconnect)
reuses it — see ADR-0009.
"""

from __future__ import annotations

from audit.ids import derive_case_id, derive_correlation_id, derive_idempotency_key


def test_case_id_prefers_case_ref() -> None:
    assert derive_case_id("PA-2026-0847", "novo-ozempic-initial") == "PA-2026-0847"


def test_case_id_falls_back_to_scenario_id() -> None:
    assert derive_case_id("", "novo-ozempic-initial") == "novo-ozempic-initial"


def test_idempotency_key_is_case_id_plus_attempt() -> None:
    assert derive_idempotency_key("PA-2026-0847", 1) == "PA-2026-0847:a1"


def test_idempotency_key_distinguishes_attempts() -> None:
    assert derive_idempotency_key("PA-2026-0847", 1) != derive_idempotency_key("PA-2026-0847", 2)


def test_idempotency_key_is_deterministic() -> None:
    """Same case + same attempt → same key, always — a retried request must
    map onto the same logical submission (no wall-clock component)."""
    assert derive_idempotency_key("PA-2026-0847", 3) == derive_idempotency_key("PA-2026-0847", 3)


def test_correlation_id_coincides_with_idempotency_key() -> None:
    """Pre-DB design (ADR-0009): the correlation_id IS the idempotency key —
    one ID traces logs, events, and the AuditRecord for a logical run."""
    assert derive_correlation_id("PA-2026-0847", 2) == derive_idempotency_key("PA-2026-0847", 2)
