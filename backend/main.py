"""main.py — FastAPI application entry point.

Routes:
  GET  /health                  — unauthenticated health check
  POST /api/appeal/generate     — SSE appeal generation (Bearer auth required)

Auth: All /api/* routes require Authorization: Bearer <API_SECRET_KEY>.
      API_SECRET_KEY is read from the environment (set via .env or CI secrets).

LLM backend selection: controlled by the LLM_BACKEND environment variable.
  "mock"  → ml.mock_backend.MockLLMBackend  (CI / local dev, no API key needed)
  "groq"  → groq-based backend              (production, requires GROQ_API_KEY)
"""

from __future__ import annotations

import hmac
import logging
import os
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from agents.graph import run_pipeline
from models.schemas import AppealEvent, AppealRequest, ErrorEvent

if TYPE_CHECKING:
    from ml.llm_backend import LLMBackend

logger = logging.getLogger(__name__)

# Load .env for local dev (README quick start). Does NOT override variables
# already set in the environment, so CI/production env wins.
load_dotenv()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="PaxOS Appeal Generation API",
    description="Streaming prior-authorization appeal generation backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Auth middleware — must run before body parsing so bad tokens get 401, not 422
# ---------------------------------------------------------------------------


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Enforce Bearer token auth on all /api/* routes before body validation."""
    if request.url.path.startswith("/api/"):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                {"detail": "Missing or invalid Authorization header"},
                status_code=401,
            )
        token = auth_header[len("Bearer "):]
        secret = _get_secret_key()
        if not secret or not hmac.compare_digest(token, secret):
            return JSONResponse(
                {"detail": "Invalid API key"},
                status_code=401,
            )
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
# SSE formatting
# ---------------------------------------------------------------------------

def _sse_line(event: AppealEvent) -> str:
    """Format a single SSE message frame."""
    return f"event: {event.event}\ndata: {event.model_dump_json()}\n\n"


async def _stream_events(request: AppealRequest) -> AsyncIterator[str]:
    # SSE headers are already sent when this generator runs — a construction
    # failure must surface as an error event, never a bare disconnect.
    try:
        llm_backend = _build_llm_backend()
    except Exception:
        logger.exception("LLM backend construction failed")
        yield _sse_line(
            ErrorEvent(message="Server LLM backend is not configured.", retry_count=0)
        )
        return
    async for event in run_pipeline(request, llm_backend=llm_backend):
        yield _sse_line(event)


# ---------------------------------------------------------------------------
# Routes
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
        _stream_events(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
