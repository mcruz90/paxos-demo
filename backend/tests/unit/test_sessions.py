"""Unit tests — the in-memory session store + demo credential check (Slice 2).

The store is the cookie-auth analogue of ``audit/store.py``: a process-global
dict, single-worker pre-DB, reset only on restart. These tests exercise it in
isolation (no HTTP): create → get, expiry, delete, and constant-time credential
verification against the DEMO_USER / DEMO_PASSWORD env vars.
"""

from __future__ import annotations

import pytest

from models.schemas import SEEDED_TENANT_ID
from security import sessions


@pytest.fixture(autouse=True)
def _clean_sessions():
    sessions.reset_sessions()
    yield
    sessions.reset_sessions()


def test_create_session_returns_distinct_id_and_csrf() -> None:
    session_id, csrf_token = sessions.create_session("demo")
    assert session_id
    assert csrf_token
    assert session_id != csrf_token


def test_get_session_returns_record_for_valid_id() -> None:
    session_id, csrf_token = sessions.create_session("demo")
    record = sessions.get_session(session_id)
    assert record is not None
    assert record.user_id == "demo"
    assert record.csrf_token == csrf_token


def test_get_session_unknown_id_returns_none() -> None:
    assert sessions.get_session("nope") is None


def test_session_carries_seeded_tenant_claim(monkeypatch) -> None:
    """P7a Slice 3 (ADR-0017): the session mint stamps the tenant claim. Pre-DB
    every login lands on the single seeded tenant, so demo/live is unchanged;
    at Phase 3 the claim source changes (mint → IdP), not this shape."""
    session_id, _ = sessions.create_session("demo")
    record = sessions.get_session(session_id)
    assert record is not None
    assert record.tenant_id == SEEDED_TENANT_ID


def test_create_session_defaults_tenant_and_accepts_override() -> None:
    default_id, _ = sessions.create_session("demo")
    assert sessions.get_session(default_id).tenant_id == SEEDED_TENANT_ID  # type: ignore[union-attr]

    other_id, _ = sessions.create_session("demo", tenant_id="tenant_other")
    assert sessions.get_session(other_id).tenant_id == "tenant_other"  # type: ignore[union-attr]


def test_delete_session_removes_it() -> None:
    session_id, _ = sessions.create_session("demo")
    sessions.delete_session(session_id)
    assert sessions.get_session(session_id) is None


def test_expired_session_is_rejected(monkeypatch) -> None:
    session_id, _ = sessions.create_session("demo")
    # Jump the clock past the TTL — the record must be treated as gone.
    real_time = sessions.time.time()
    monkeypatch.setattr(
        sessions.time, "time", lambda: real_time + sessions.SESSION_TTL_SECONDS + 1
    )
    assert sessions.get_session(session_id) is None


def test_create_session_purges_expired_entries(monkeypatch) -> None:
    """Abandoned logins must not accumulate forever. get_session only evicts a
    record when that same id is read again, so a session no one revisits leaks.
    create_session (the growth event) opportunistically purges already-expired
    entries, bounding the store by the count of live sessions."""
    stale_id, _ = sessions.create_session("demo")
    real_time = sessions.time.time()
    # Advance past the TTL, then create a fresh session — the stale one is purged
    # even though nobody read it.
    monkeypatch.setattr(
        sessions.time, "time", lambda: real_time + sessions.SESSION_TTL_SECONDS + 1
    )
    fresh_id, _ = sessions.create_session("demo")
    assert stale_id not in sessions._SESSIONS
    assert fresh_id in sessions._SESSIONS


def test_verify_credentials_matches_env(monkeypatch) -> None:
    monkeypatch.setenv("DEMO_USER", "alice")
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")
    assert sessions.verify_credentials("alice", "s3cret") is True
    assert sessions.verify_credentials("alice", "wrong") is False
    assert sessions.verify_credentials("mallory", "s3cret") is False


def test_verify_credentials_uses_constant_time_compare(monkeypatch) -> None:
    """Credential check must go through hmac.compare_digest, not ``==`` — same
    timing-side-channel defense as the Bearer middleware."""
    monkeypatch.setenv("DEMO_USER", "alice")
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")

    calls: list[tuple] = []
    real = sessions.hmac.compare_digest

    def spy(a, b):
        calls.append((a, b))
        return real(a, b)

    monkeypatch.setattr(sessions.hmac, "compare_digest", spy)
    sessions.verify_credentials("alice", "s3cret")
    assert calls, "credentials compared without hmac.compare_digest"
