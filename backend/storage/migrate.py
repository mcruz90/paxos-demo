"""Explicit atomic PostgreSQL migrations; no URL defaults or automatic startup DDL."""

import argparse
import json
import os
from pathlib import Path

import psycopg

from storage.config import DatabaseConfigurationError, load_database_config
from storage.connection import checked_connection
from storage.migration_files import Migration, MigrationError, load_migrations

_REGISTRY = """
CREATE TABLE IF NOT EXISTS clearauth_schema_migrations (
    version text PRIMARY KEY,
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    applied_at timestamptz NOT NULL DEFAULT now()
)
"""


def apply_migrations(
    connection: psycopg.Connection, migrations: tuple[Migration, ...]
) -> tuple[str, ...]:
    """Apply all pending migrations atomically under a transaction-scoped lock."""
    with connection.transaction():
        connection.execute("SELECT pg_advisory_xact_lock(%s)", (2133745026,))
        connection.execute(_REGISTRY)
        installed: dict[str, str] = dict(
            connection.execute("SELECT version, sha256 FROM clearauth_schema_migrations").fetchall()
        )
        local = {item.version: item.sha256 for item in migrations}
        if installed.keys() - local.keys():
            raise MigrationError("migration_history_incomplete")
        if any(local[version] != digest for version, digest in installed.items()):
            raise MigrationError("migration_checksum_mismatch")
        if set(installed) != set(list(local)[: len(installed)]):
            raise MigrationError("migration_order_mismatch")
        applied = []
        for item in migrations:
            if item.version in installed:
                continue
            _apply_one(connection, item)
            applied.append(item.version)
    return tuple(applied)


def _apply_one(connection: psycopg.Connection, item: Migration) -> None:
    try:
        connection.execute(item.sql, prepare=False)
        connection.execute(
            "INSERT INTO clearauth_schema_migrations (version, sha256) VALUES (%s, %s)",
            (item.version, item.sha256),
        )
    except psycopg.Error as exc:
        # SQLSTATE and trusted migration version locate failures without SQL/data.
        state = exc.sqlstate or "unknown"
        raise MigrationError(f"migration_execution_failed:{item.version}:{state}") from None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", action="store_true", help="Require separate TEST_DATABASE_URL")
    args = parser.parse_args()
    try:
        config = load_database_config(os.environ, test=args.test)
        migrations = load_migrations(Path(__file__).with_name("sql"))
        with checked_connection(config) as connection:
            applied = apply_migrations(connection, migrations)
    except (DatabaseConfigurationError, MigrationError) as exc:
        raise SystemExit(str(exc)) from None
    print(json.dumps({"applied_versions": applied}))


if __name__ == "__main__":
    main()
