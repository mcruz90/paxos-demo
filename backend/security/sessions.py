"""security/sessions.py — pre-DB in-memory session store for the BFF (Slice 2).

The cookie-auth analogue of ``audit/store.py``: a process-global dict keyed by
opaque session id, holding the session's ``user_id`` + CSRF token + expiry. It
survives the request lifecycle and resets only on server restart.

Known limit (accepted pre-DB, per CLAUDE.md ACID §Durability — same as the
audit list and the checkpointer): an in-process dict silently shards under
multiple uvicorn workers, so a session created on one worker is invisible to
another. Acceptable for the single-worker demo; a shared session store (Redis /
signed stateless tokens) replaces it when the deploy goes multi-worker.

No locks: FastAPI runs on a single-threaded asyncio event loop, and every
mutation here is a single dict operation between awaits — there is no
concurrent-mutation window to guard (ADR-0013).

Expiry policy (no background sweeper, by decision): a session is evicted lazily
on read (``get_session``) AND opportunistically on the next ``create_session``,
which purges every already-expired entry. Login is the store's only growth
event, so purging there bounds the store by the count of *live* sessions —
abandoned logins (minted, then never revisited) can no longer accumulate
forever. A sweeper thread is the alternative, unnecessary while login is the
only growth path.
"""

from __future__ import annotations

import hmac
import os
import secrets
import time
from dataclasses import dataclass

from models.schemas import SEEDED_TENANT_ID

# Fixed 30-minute TTL, checked on read. No sliding refresh (that would turn
# every authenticated read into a write) and no background sweeper — an expired
# record is evicted on the next read of its id or on the next create_session
# (see the module docstring's expiry policy).
SESSION_TTL_SECONDS = 30 * 60

# Wire names shared by the auth routes (set/clear) and the middleware (read) —
# single source of truth so the two sides cannot drift.
COOKIE_NAME = "paxos_session"
CSRF_HEADER = "X-CSRF-Token"


@dataclass(frozen=True)
class Session:
    """One authenticated browser session (server-side; never serialized to JS)."""

    user_id: str
    csrf_token: str
    expires_at: float
    # Tenancy claim (ADR-0017): the customer org this session acts within. The
    # two read endpoints derive their TenancyScope from it. Pre-DB every login
    # lands on the single seeded tenant; at Phase 3 the source changes (mint →
    # IdP), not this field. (Role/panel claims are deferred to the durable store
    # — there is no pre-DB source to mint them from; ADR-0017 point 2.)
    tenant_id: str = SEEDED_TENANT_ID


_SESSIONS: dict[str, Session] = {}


def create_session(user_id: str, tenant_id: str = SEEDED_TENANT_ID) -> tuple[str, str]:
    """Mint a session for *user_id* in *tenant_id*. Returns ``(session_id, csrf_token)``.

    ``session_id`` becomes the httpOnly cookie value; ``csrf_token`` is returned
    in the login body for the double-submit CSRF check. Both are opaque
    ``secrets.token_urlsafe`` values. ``tenant_id`` is the tenancy claim stamped
    on the session (ADR-0017); pre-DB it defaults to the single seeded tenant.

    Opportunistically purges already-expired sessions first (see the expiry
    policy in the module docstring): login is the only growth event, so this
    bounds the store by the count of live sessions.
    """
    now = time.time()
    for expired_id in [sid for sid, s in _SESSIONS.items() if now >= s.expires_at]:
        del _SESSIONS[expired_id]

    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    _SESSIONS[session_id] = Session(
        user_id=user_id,
        csrf_token=csrf_token,
        expires_at=time.time() + SESSION_TTL_SECONDS,
        tenant_id=tenant_id,
    )
    return session_id, csrf_token


def get_session(session_id: str) -> Session | None:
    """Return the live session for *session_id*, or None if unknown or expired.

    An expired record is evicted on this read (the only reaping path).
    """
    session = _SESSIONS.get(session_id)
    if session is None:
        return None
    if time.time() >= session.expires_at:
        del _SESSIONS[session_id]
        return None
    return session


def delete_session(session_id: str) -> None:
    """Destroy a session (logout). No-op if it is already gone."""
    _SESSIONS.pop(session_id, None)


def reset_sessions() -> None:
    """Clear the store. Tests only — production resets only on restart."""
    _SESSIONS.clear()


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time check of *username* / *password* against the demo env vars.

    Both comparisons run (no short-circuit) so a failure does not reveal whether
    the username or the password was wrong. Unset env vars compare as ``""`` and
    fail closed. Same ``hmac.compare_digest`` discipline as the Bearer middleware.
    """
    expected_user = os.environ.get("DEMO_USER", "")
    expected_password = os.environ.get("DEMO_PASSWORD", "")
    user_ok = hmac.compare_digest(username, expected_user)
    password_ok = hmac.compare_digest(password, expected_password)
    return user_ok and password_ok
