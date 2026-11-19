"""FastAPI startup verifies PostgreSQL but never applies migrations."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from storage.config import load_database_config
from storage.connection import checked_connection


@asynccontextmanager
async def database_lifespan(app: FastAPI):
    config = load_database_config(os.environ)
    with checked_connection(config):
        pass
    app.state.database_config = config
    try:
        yield
    finally:
        del app.state.database_config
