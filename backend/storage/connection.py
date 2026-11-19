"""Bounded PostgreSQL connection with identity verification before callers get it."""

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg

from storage.config import DatabaseConfig, DatabaseConfigurationError, verify_database_identity


@contextmanager
def checked_connection(config: DatabaseConfig) -> Iterator[psycopg.Connection]:
    try:
        with psycopg.connect(
            dbname=config.database,
            user=config.user,
            password=config.password,
            host=config.host,
            port=config.port,
            connect_timeout=3,
            options="-c statement_timeout=5000 -c lock_timeout=2000",
        ) as connection:
            row = connection.execute(
                "SELECT current_database(), current_setting('server_version_num')"
            ).fetchone()
            if row is None:
                raise DatabaseConfigurationError("database_identity_missing")
            verify_database_identity(config, row[0], row[1])
            yield connection
    except psycopg.Error:
        # Never propagate a driver message containing connection/statement values.
        raise DatabaseConfigurationError("database_operation_failed") from None
