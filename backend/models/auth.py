"""Auth wire contracts — session-cookie login for the FastAPI BFF (Slice 2).

The browser authenticates with an httpOnly session cookie instead of the
Bearer key (which stays the service/CI credential). These are the request /
response bodies for the three ``/api/auth/*`` routes; the opaque session id and
the CSRF token themselves live server-side in ``security/sessions.py`` and never
appear in a request body. Re-exported through ``models.schemas`` — import from
there, not from here.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    """Strict-validated request body for POST /api/auth/login.

    Checked with constant-time comparison against the ``DEMO_USER`` /
    ``DEMO_PASSWORD`` env vars (the pre-DB demo credential store).
    """

    model_config = ConfigDict(strict=True)

    username: Annotated[str, Field(min_length=1, max_length=150)]
    password: Annotated[str, Field(min_length=1, max_length=200)]


class LoginResponse(BaseModel):
    """Response body for a successful login.

    The session id itself is delivered only as the httpOnly ``paxos_session``
    cookie (never in the body, so JS cannot read it). ``csrf_token`` IS returned
    in the body so the SPA can echo it in the ``X-CSRF-Token`` header on
    cookie-authenticated writes (double-submit CSRF defense).
    """

    user_id: str
    csrf_token: str


class MeResponse(BaseModel):
    """Response body for GET /api/auth/me — the current session's user."""

    user_id: str
