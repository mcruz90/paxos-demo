"""api/auth.py — session-cookie auth routes for the BFF (Slice 2, ADR-0013).

Three routes under ``/api/auth``:

* ``POST /login``  — issue a session (unauthenticated: the credential-issuing
  endpoint; the ``auth_middleware`` skips it),
* ``POST /logout`` — destroy the session (requires a session + CSRF header),
* ``GET  /me``     — the current session's user (requires a session).

Route handlers only, no business logic (CLAUDE.md §File Organization): session
minting/validation and the constant-time credential check live in
``security/sessions.py``; identity for ``require_session`` is resolved by the
middleware and read here as a plain value off ``request.state``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from models.schemas import LoginRequest, LoginResponse, MeResponse
from security.sessions import (
    COOKIE_NAME,
    SESSION_TTL_SECONDS,
    create_session,
    delete_session,
    verify_credentials,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def require_session(request: Request) -> str:
    """Return the session user_id, or 401 if the caller has no cookie session.

    The middleware authorizes ``/api/*`` on Bearer OR cookie and stamps the
    resolved cookie user_id on ``request.state.session_user_id`` ("" for Bearer /
    service callers). ``/me`` and ``/logout`` are session-only, so an empty value
    is the "401 otherwise" case of the ``/me`` contract.
    """
    user_id: str = request.state.session_user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Session required")
    return user_id


@router.post("/login")
async def login(body: LoginRequest, response: Response) -> LoginResponse:
    """Validate demo credentials, mint a session, set the httpOnly cookie."""
    if not verify_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_id, csrf_token = create_session(user_id=body.username)
    response.set_cookie(
        COOKIE_NAME,
        session_id,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/",
    )
    return LoginResponse(user_id=body.username, csrf_token=csrf_token)


@router.post("/logout", status_code=204)
async def logout(request: Request, _user_id: str = Depends(require_session)) -> Response:
    """Destroy the session and clear the cookie."""
    delete_session(request.cookies[COOKIE_NAME])
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, path="/")
    return response


@router.get("/me")
async def me(user_id: str = Depends(require_session)) -> MeResponse:
    """Return the current session's user (401 if there is no session)."""
    return MeResponse(user_id=user_id)
