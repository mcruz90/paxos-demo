"""openapi_ext.py — OpenAPI schema customization for the FastAPI app.

Why this file exists: the SSE routes (``/api/appeal/generate``,
``/api/appeal/resume``, ``/api/pa/submit``) return ``StreamingResponse``, so
FastAPI has no typed response model to introspect — the wire shapes a client
actually receives (``StepEvent``/``ChunkEvent``/``DoneEvent``/``ErrorEvent`` and
``InitialPaDoneEvent``) never land in ``components.schemas`` on their own. The
frontend generates its TypeScript wire types from this OpenAPI document
(Slice 1 of the frontend-integration sprint; ADR-0012), and typed SSE events
are the whole point of that pipeline. So we register the event models
explicitly here.

This runs for both the live server's ``/openapi.json`` and the checked-in
dump (``tools/dump_openapi.py``) — one registration point, so the live
contract and the generated types never disagree (DRY / single source of truth).

Pydantic stays the authored source of truth: every schema below is derived from
a ``BaseModel``, never hand-written.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi.openapi.utils import get_openapi

from models.schemas import (
    ChunkEvent,
    DoneEvent,
    ErrorEvent,
    InitialPaDoneEvent,
    StepEvent,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from fastapi import FastAPI
    from pydantic import BaseModel

# The SSE event models emitted by the streaming routes. FastAPI cannot infer
# these from a StreamingResponse, so they are registered by hand. This list
# must stay in sync with the AppealEvent / InitialPaEvent unions in
# models.events; test_schema_parity.test_sse_event_registration_covers_the_event_unions
# is the reader that fails the build if it drifts. (The CI freshness guard
# cannot catch this: an unregistered new event yields an equally-incomplete
# artifact — no diff — so the parity test, not the diff, is the guard.)
_SSE_EVENT_MODELS: tuple[type[BaseModel], ...] = (
    StepEvent,
    ChunkEvent,
    DoneEvent,
    ErrorEvent,
    InitialPaDoneEvent,
)


def add_sse_event_schemas(schema: dict[str, Any]) -> dict[str, Any]:
    """Inject the SSE event models into ``components.schemas`` in place.

    Each model's JSON schema is emitted with refs pointing at
    ``#/components/schemas/...`` (OpenAPI's component namespace, not Pydantic's
    ``$defs``), and any nested definitions it references (enums like
    ``CaseTier``, domain models like ``PaOutcome``) are hoisted up alongside it.
    ``setdefault`` is used throughout so a definition already contributed by a
    request/response model is never clobbered.
    """
    components = schema.setdefault("components", {}).setdefault("schemas", {})
    for model in _SSE_EVENT_MODELS:
        model_schema = model.model_json_schema(
            ref_template="#/components/schemas/{model}"
        )
        # Hoist nested definitions (CaseTier, PaOutcome, ...) into components.
        for name, defn in model_schema.pop("$defs", {}).items():
            components.setdefault(name, defn)
        components.setdefault(model.__name__, model_schema)
    return schema


def build_openapi(app: FastAPI) -> Callable[[], dict[str, Any]]:
    """Return a cached ``app.openapi`` replacement that registers SSE events.

    Wire it in ``main.py`` with ``app.openapi = build_openapi(app)``. The result
    follows FastAPI's standard cache contract (``app.openapi_schema`` memoizes
    the first build).
    """

    def custom_openapi() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        add_sse_event_schemas(schema)
        app.openapi_schema = schema
        return schema

    return custom_openapi
