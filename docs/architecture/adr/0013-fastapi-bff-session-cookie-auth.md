# ADR-0013: FastAPI as its own BFF — session-cookie auth beside Bearer

- **Status:** Accepted
- **Date:** 2026-07-09 (frontend-integration sprint, Slice 2)
- **Decided by:** May (architect ruling: FastAPI becomes its own BFF; add a
  session-cookie layer beside Bearer — settled, this ADR records it)

## Context

Until now every `/api/*` route took one credential: `Authorization: Bearer
<API_SECRET_KEY>`, a single shared service secret ([06-api-contract.md](../06-api-contract.md)).
That is correct for the smoke-tour and CI, but the browser SPA (the
frontend-integration sprint) now needs to authenticate real users, and a shared
service secret is the wrong credential for a browser:

- it is one secret for everyone, so there is no per-user identity — nothing to
  put in `AuditRecord.reviewed_by` when a human clears an exception run;
- anything the browser holds in JS is exfiltratable by an XSS payload, and this
  is a PHI codebase.

How the browser should authenticate was the fork:

- **Option A — ship the Bearer key to the browser** (embed `API_SECRET_KEY` as
  `VITE_API_KEY` in the SPA, as the demo POC does). Zero new code, but it hands
  the shared service secret to every browser, any XSS steals it, and it still
  carries no user identity. Fine for a mock demo, unacceptable for a real login.
- **Option B — a full OAuth2/OIDC identity provider** (Auth0/Cognito/Keycloak,
  JWT access + refresh tokens). The eventual right answer at scale, but it adds
  an external dependency and a token-refresh dance now, before there is even a
  user database — premature, and a dependency in a PHI tree we would have to
  vet (CLAUDE.md §Dependency Security).
- **Option C — FastAPI as its own BFF (chosen).** The backend issues its own
  opaque, server-side session behind an httpOnly cookie via a login route, and
  keeps the Bearer scheme unchanged for service/CI. No new dependency, the
  session token is unreachable from JS, and there is a named user to attribute
  actions to. Migrating to Option B later swaps what `/api/auth/login` does
  internally without changing how any caller authenticates.

## Decision

We adopt **Option C**. Specifically:

1. **A session-cookie layer beside Bearer, not replacing it.** `/api/*` is
   authorized if EITHER a valid Bearer key (existing path, byte-for-byte
   unchanged — smoke-tour and CI keep working) OR a valid `paxos_session`
   cookie. The auth middleware resolves the two in that order.
2. **Three auth routes in `api/auth.py`.** `POST /api/auth/login` validates
   `{username, password}` against the `DEMO_USER`/`DEMO_PASSWORD` env vars with
   `hmac.compare_digest` (same constant-time discipline as the Bearer check),
   mints an opaque `secrets.token_urlsafe` session id, and sets it as an
   httpOnly, Secure, SameSite=Strict cookie (~30-min max-age). `POST
   /api/auth/logout` destroys the session (204); `GET /api/auth/me` returns the
   session's user. **`login` is the one unauthenticated `/api/*` route** — it is
   the credential-issuing endpoint, so it cannot require the credential it
   issues (justified per CLAUDE.md §Security Defaults).
3. **Server-side session store, pre-DB (`security/sessions.py`).** A
   process-global dict keyed by session id → `(user_id, csrf_token,
   expires_at)`. Fixed 30-min TTL checked on read, expired records evicted on
   read — no background sweeper. This is the exact in-memory analogue of the
   audit list ([ADR-0009](0009-idempotency-key-and-audit-writes.md)) and the
   checkpointer ([ADR-0010](0010-in-memory-checkpointer-exception-interrupt.md)),
   with the same single-worker caveat. No locks: single-threaded asyncio event
   loop, every mutation a single dict op.
4. **CSRF: double-submit for cookie-authenticated writes.** A cookie-auth
   non-GET request must carry an `X-CSRF-Token` header matching the session's
   stored token (returned in the login body, not the cookie, so JS can echo it
   but a cross-site form cannot). SameSite=Strict is the first line; the token
   is defense-in-depth. **Bearer requests are CSRF-exempt** — they are not
   browser-driven and carry no ambient cookie to forge.
5. **CORS tightened.** `allow_origins` moves from `["*"]` to a `CORS_ORIGINS`
   allowlist (default `http://localhost:5173`) with `allow_credentials=True`,
   because a browser will not send credentials to a wildcard origin.
6. **Actor attribution.** `AuditRecord` gains `reviewed_by`. A
   cookie-authenticated `POST /api/appeal/resume` threads the session's
   `user_id` into the resume audit record; a Bearer-authenticated resume sets
   `reviewed_by=""` — the service identity has no named human reviewer, and
   recording a fake one would violate CLAUDE.md §AI Output Accountability. The
   middleware resolves identity onto `request.state`; the route reads it as a
   plain value so `api/` stays logic-free.

## Consequences

- **The browser never holds a service secret and never a JS-readable token.**
  httpOnly defeats XSS token theft; per-user identity now exists for the audit
  trail.
- **The Bearer path is untouched**, so every existing `/api/*` test, the
  smoke-tour, and CI pass unchanged — the new scheme is purely additive.
- **`main.py` split (`sse.py`).** Adding the middleware pushed `main.py` over
  the ~300-line cap, so the SSE framing + stream generators moved to `sse.py`.
  The LLM-backend factory **stays in `main.py`** (the strategy-pattern rule,
  [ADR-0002](0002-provider-neutral-llm-backend.md)): `sse.stream_events`
  receives it as a callable, so `sse.py` names no provider and there is no
  import cycle.
- **Single-worker only, pre-DB.** Sessions shard under multiple uvicorn workers
  exactly as the audit list and checkpointer do. A shared session store (Redis
  or signed stateless tokens) lands with the Phase 3 durable-store milestone —
  the natural point to also revisit Option B (a real IdP).
- **No new dependency**; `secrets`/`hmac` are stdlib. Nothing to vet under
  CLAUDE.md §Dependency Security.
- **`reviewed_by` is a new AuditRecord field** that the resume path populates;
  every pre-existing boundary write keeps its default `""` (machine identity),
  so no historical record lies.
