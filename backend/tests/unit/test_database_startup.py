"""Startup boundary tests; the database I/O boundary is replaced explicitly."""

from contextlib import contextmanager

import pytest
from fastapi import FastAPI

from storage import lifecycle
from storage.config import DatabaseConfigurationError


@pytest.mark.asyncio
async def test_startup_requires_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    app = FastAPI()
    with pytest.raises(DatabaseConfigurationError, match="DATABASE_URL_required"):
        async with lifecycle.database_lifespan(app):
            pytest.fail("startup must not complete")


@pytest.mark.asyncio
async def test_startup_checks_before_yield_and_does_not_keep_connection(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://fake:fake@127.0.0.1:55432/clearauth_integration"
    )
    events = []

    @contextmanager
    def checked(config):
        events.append("check")
        yield None
        events.append("closed")

    monkeypatch.setattr(lifecycle, "checked_connection", checked)
    app = FastAPI()
    async with lifecycle.database_lifespan(app):
        assert events == ["check", "closed"]
        assert app.state.database_config.database == "clearauth_integration"


@pytest.mark.asyncio
async def test_wrong_server_blocks_startup(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql://fake:fake@127.0.0.1:55432/clearauth_integration"
    )

    @contextmanager
    def rejected(config):
        raise DatabaseConfigurationError("database_identity_mismatch")
        yield  # makes this a context manager; never reached

    monkeypatch.setattr(lifecycle, "checked_connection", rejected)
    with pytest.raises(DatabaseConfigurationError, match="database_identity_mismatch"):
        async with lifecycle.database_lifespan(FastAPI()):
            pytest.fail("startup must not complete")
