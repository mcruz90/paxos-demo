"""main.py — FastAPI application entry point.

Routes:
  GET  /health                  — unauthenticated health check
  POST /api/auth/login          — issue a session cookie (unauthenticated)
  POST /api/auth/logout         — destroy the session (session + CSRF)
  GET  /api/auth/me             — current session's user (session)
  POST /api/appeal/generate     — SSE appeal generation
  POST /api/appeal/resume       — SSE resume of a parked exception run (no LLM)
  GET  /api/audit/records       — list the audit trail (read-only, metadata only)
  GET  /api/reviews/pending     — list parked exception runs awaiting review (read-only)
  POST /api/pa/submit           — SSE initial-PA lifecycle (no LLM)

Auth (ADR-0013): every /api/* route accepts EITHER Authorization: Bearer
      <API_SECRET_KEY> (service/CI) OR a valid `paxos_session` cookie (browser).
      Cookie-authenticated writes also require an X-CSRF-Token header; Bearer
      requests are CSRF-exempt. /api/auth/login is the one unauthenticated
      /api/* route (it issues the credential). The auth routes live in api/auth.py.

LLM backend selection: controlled by the LLM_BACKEND environment variable.
  "mock"  → ml.mock_backend.MockLLMBackend  (CI / local dev, no API key needed)
  "groq"  → groq-based backend              (production, requires GROQ_API_KEY)
"""

from __future__ import annotations

import hmac
import os
from typing import TYPE_CHECKING

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from agents.review_queue import derive_pending_reviews, is_run_parked
from api.auth import router as auth_router
from audit.store import all_records
from models.schemas import (
    AppealRequest,
    AuditRecordsResponse,
    InitialPaRequest,
    PendingReviewsResponse,
    ResumeAppealRequest,
)
from openapi_ext import build_openapi
from security.sessions import COOKIE_NAME, CSRF_HEADER, get_session
from security.tenancy import TenancyScope
from sse import stream_events, stream_initial_pa_events, stream_resume_events

if TYPE_CHECKING:
    from ml.llm_backend import LLMBackend

# Load .env for local dev (README quick start). Does NOT override variables
# already set in the environment, so CI/production env wins.
load_dotenv()

# langsmith is a mandatory transitive of langchain-core (LangGraph, ADR-0001),
# and its tracing uploads payloads to LangChain's hosted SaaS when enabled via
# env vars. In a PHI codebase that must be a deliberate code change, never a
# stray env var on a deploy host — hard-disable it after load_dotenv() so it
# overrides .env and inherited environment alike. (Planned observability is
# self-hosted Langfuse; see the deferred block in pyproject.toml.)
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="PaxOS Appeal Generation API",
    description="Streaming prior-authorization appeal generation backend.",
    version="0.1.0",
)

# The SSE routes return StreamingResponse, so their event shapes are invisible
# to FastAPI's default schema generation. Register them explicitly so the
# generated TypeScript wire types include typed SSE events (openapi_ext, ADR-0012).
app.openapi = build_openapi(app)  # type: ignore[method-assign]  # FastAPI's documented override pattern

# CORS: cookie auth needs credentialed requests, so allow_origins can no longer
# be "*" (browsers reject "*" + credentials). Read an explicit allowlist from
# CORS_ORIGINS (comma-separated); default to the Vite dev server (ADR-0013).
_CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session-cookie auth routes (login / logout / me) — the BFF credential surface
# beside the Bearer scheme (ADR-0013).
app.include_router(auth_router)

# ---------------------------------------------------------------------------
# Auth middleware — must run before body parsing so bad tokens get 401, not 422
# ---------------------------------------------------------------------------


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Authorize /api/* on EITHER Bearer key OR session cookie (ADR-0013).

    Runs before body validation so a bad token gets 401, not 422. Resolves the
    caller's identity onto ``request.state.session_user_id`` ("" for Bearer /
    service callers) so a route can attribute an action without re-parsing auth.

    - ``POST /api/auth/login`` is unauthenticated — the credential-issuing route.
    - Bearer requests are exempt from CSRF (service/CI identity, no browser).
    - Cookie-authenticated writes (non-GET) require an ``X-CSRF-Token`` header
      matching the session's token (double-submit defense).
    """
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    # CORS preflight: an OPTIONS carries no credential (browsers strip it), so
    # authenticating it would 401 every cross-origin call before CORSMiddleware
    # can answer. A preflight grants nothing — pass it through (ADR-0013).
    if request.method == "OPTIONS":
        return await call_next(request)

    request.state.session_user_id = ""

    if request.url.path == "/api/auth/login":
        return await call_next(request)

    # (a) Bearer path — unchanged, CSRF-exempt.
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        secret = _get_secret_key()
        if not secret or not hmac.compare_digest(token, secret):
            return JSONResponse({"detail": "Invalid API key"}, status_code=401)
        return await call_next(request)

    # (b) Session-cookie path.
    session = get_session(request.cookies.get(COOKIE_NAME, ""))
    if session is None:
        return JSONResponse(
            {"detail": "Missing or invalid Authorization header"}, status_code=401
        )
    if request.method != "GET" and not hmac.compare_digest(
        request.headers.get(CSRF_HEADER, ""), session.csrf_token
    ):
        return JSONResponse(
            {"detail": "Missing or invalid CSRF token"}, status_code=403
        )
    request.state.session_user_id = session.user_id
    return await call_next(request)


_API_SECRET_KEY: str | None = None


def _get_secret_key() -> str:
    """Read API_SECRET_KEY from env, cached after first call."""
    global _API_SECRET_KEY
    if _API_SECRET_KEY is None:
        _API_SECRET_KEY = os.environ.get("API_SECRET_KEY", "")
    return _API_SECRET_KEY


# ---------------------------------------------------------------------------
# LLM backend factory — provider selection is the ONLY place a provider is
# named. The pipeline codes against ml.llm_backend.LLMBackend (Protocol);
# adding a provider = one new module in ml/ + one branch here.
# The provider decision is deliberately open, so there is no silent default.
# ---------------------------------------------------------------------------

_AVAILABLE_BACKENDS = ("mock", "groq")


def _build_llm_backend() -> LLMBackend:
    """Instantiate the LLM backend selected by the LLM_BACKEND env var."""
    backend_name = os.environ.get("LLM_BACKEND", "").lower()

    if not backend_name:
        raise ValueError(
            "LLM_BACKEND is not set. No provider is defaulted — set LLM_BACKEND "
            f"to one of: {', '.join(_AVAILABLE_BACKENDS)}."
        )

    if backend_name == "mock":
        from ml.mock_backend import MockLLMBackend
        return MockLLMBackend()

    if backend_name == "groq":
        # Lazy import so groq package errors only surface at runtime,
        # not on import (allows CI lint to run without GROQ_API_KEY).
        from ml.groq_backend import GroqBackend
        return GroqBackend(api_key=os.environ["GROQ_API_KEY"])

    raise ValueError(
        f"Unknown LLM_BACKEND: {backend_name!r}. "
        f"Available: {', '.join(_AVAILABLE_BACKENDS)}."
    )


# ---------------------------------------------------------------------------
# Routes — SSE framing + stream generators live in sse.py (transport glue).
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict:
    """Unauthenticated health check — used by load balancers and CI smoke tests."""
    return {"status": "ok"}


@app.post("/api/appeal/generate")
async def generate_appeal(body: AppealRequest) -> StreamingResponse:
    """Stream an appeal letter as Server-Sent Events.

    Authentication: enforced by the auth_middleware before this is reached.

    Returns a ``text/event-stream`` response emitting ``step``, ``chunk``,
    ``done``, and ``error`` events.
    """
    return StreamingResponse(
        stream_events(body, _build_llm_backend),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/appeal/resume")
async def resume_appeal(body: ResumeAppealRequest, request: Request) -> StreamingResponse:
    """Resume a parked exception-tier appeal run for a human reviewer (S3
    Slice 4b).

    Authentication: enforced by the auth_middleware before this is reached,
    which also resolves the caller identity onto ``request.state`` — passed down
    as ``reviewed_by`` for the resume audit entry (ADR-0013). The handler stays
    logic-free: it reads a plain value, it does not parse auth.
    No LLM_BACKEND required — the resume path invokes no model.

    Returns a ``text/event-stream`` emitting a terminal ``done`` (the human
    reviewed/edited letter) or ``error`` (nothing awaiting review for the
    given ``correlation_id``).
    """
    return StreamingResponse(
        stream_resume_events(body, request.state.session_user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/audit/records")
async def list_audit_records() -> AuditRecordsResponse:
    """List the audit trail (S3 Task 3) — read-only, metadata + hashes only.

    Authentication: enforced by the auth_middleware before this is reached.
    Returns every :class:`AuditRecord` as-is (identifiers and hashes by design,
    never letter/request text).
    """
    # Slice 2: platform scope preserves the current see-everything behavior;
    # Slice 3 replaces this with the caller's session-derived TenancyScope.
    return AuditRecordsResponse(records=all_records(TenancyScope.platform()))


@app.get("/api/reviews/pending")
async def list_pending_reviews() -> PendingReviewsResponse:
    """List exception-tier runs awaiting human review (S3 Task 3).

    Authentication: enforced by the auth_middleware before this is reached.
    Metadata only — never the draft body (a deferred Slice 4c surface). The
    queue is derived from the audit trail (ADR-0011); the handler only wires
    the store snapshot and the live parked-check into the pure derivation.
    """
    # Slice 2: platform scope preserves current behavior; Slice 3 replaces it
    # with the caller's session-derived TenancyScope. The queue reads through
    # the same scoped store boundary, so it is tenant-scoped transitively.
    return PendingReviewsResponse(
        reviews=derive_pending_reviews(
            all_records(TenancyScope.platform()), is_run_parked
        )
    )


@app.post("/api/pa/submit")
async def submit_initial_pa(body: InitialPaRequest) -> StreamingResponse:
    """Run the initial-PA lifecycle as Server-Sent Events.

    Authentication: enforced by the auth_middleware before this is reached.

    Returns a ``text/event-stream`` response emitting ``step`` and a terminal
    ``done`` (InitialPaDoneEvent) or ``error`` event — never ``chunk``
    (no LLM in this path).
    """
    return StreamingResponse(
        stream_initial_pa_events(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
