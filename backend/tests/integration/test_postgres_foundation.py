"""Real PostgreSQL checks: explicit separate test URL, isolated per-test schemas."""

import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql

from storage.config import load_database_config
from storage.connection import checked_connection
from storage.migrate import apply_migrations
from storage.migration_files import Migration, MigrationError, load_migrations

pytestmark = pytest.mark.postgres
MIGRATIONS = load_migrations(Path(__file__).parents[2] / "storage/sql")
EXPECTED_VERSIONS = tuple(item.version for item in MIGRATIONS)


@pytest.fixture
def isolated_database():
    if not os.environ.get("TEST_DATABASE_URL"):
        pytest.skip("explicit TEST_DATABASE_URL required; no application URL fallback")
    config = load_database_config(os.environ, test=True)
    schema = "ca_test_" + uuid4().hex
    with checked_connection(config) as conn:
        conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
    try:
        yield config, schema
    finally:
        # Only this fixture's UUID schema in the validated test database is removed.
        with checked_connection(config) as conn:
            conn.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(schema)))


@contextmanager
def connection_for(target):
    config, schema = target
    with checked_connection(config) as conn:
        conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
        yield conn


def test_migrate_repeat_and_reconnect_persists_case(isolated_database):
    with connection_for(isolated_database) as conn:
        assert apply_migrations(conn, MIGRATIONS) == EXPECTED_VERSIONS
        conn.execute(
            "INSERT INTO clearauth_cases (tenant_id, case_id, patient_ref) VALUES (%s, %s, %s)",
            ("tenant-x", "00000000-0000-4000-8000-000000000001", "PAT-X"),
        )
    with connection_for(isolated_database) as conn:
        assert apply_migrations(conn, MIGRATIONS) == ()
        assert conn.execute("SELECT revision FROM clearauth_cases").fetchone() == (1,)
        assert conn.execute("SELECT count(*) FROM clearauth_schema_migrations").fetchone() == (
            len(MIGRATIONS),
        )


@pytest.mark.parametrize("mode", ["changed", "missing"])
def test_changed_or_missing_history_is_rejected(isolated_database, mode):
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, MIGRATIONS)
    altered = () if mode == "missing" else (Migration("0001", "0" * 64, "SELECT 1"),)
    with connection_for(isolated_database) as conn:
        with pytest.raises(MigrationError, match="history_incomplete|checksum_mismatch"):
            apply_migrations(conn, altered)
        assert conn.execute("SELECT count(*) FROM clearauth_schema_migrations").fetchone() == (
            len(MIGRATIONS),
        )


def test_entire_pending_batch_rolls_back_on_failure(isolated_database):
    body = "CREATE TABLE partial_write (value integer); SELECT 1/0;"
    failed = Migration("9999", sha256(body.encode()).hexdigest(), body)
    with connection_for(isolated_database) as conn:
        with pytest.raises(MigrationError, match="migration_execution_failed:9999:22012") as exc:
            apply_migrations(conn, MIGRATIONS + (failed,))
        assert "partial_write" not in str(exc.value)
        assert body not in str(exc.value)
        for table in (
            "partial_write",
            "clearauth_cases",
            "clearauth_case_events",
            "clearauth_schema_migrations",
        ):
            assert conn.execute("SELECT to_regclass(%s)", (table,)).fetchone() == (None,)
        assert apply_migrations(conn, MIGRATIONS) == EXPECTED_VERSIONS


def test_two_runners_apply_each_version_once(isolated_database):
    barrier = Barrier(2)

    def run():
        with connection_for(isolated_database) as conn:
            barrier.wait(timeout=5)
            return apply_migrations(conn, MIGRATIONS)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: run(), range(2)))
    assert sorted(results) == [(), EXPECTED_VERSIONS]


def test_older_migration_cannot_be_added_behind_installed_history(isolated_database):
    body = "SELECT 2;"
    later = Migration("9999", sha256(body.encode()).hexdigest(), body)
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, MIGRATIONS + (later,))
        # Simulate incomplete history; the runner must not fill the gap silently.
        conn.execute("DELETE FROM clearauth_schema_migrations WHERE version = '0001'")
        with pytest.raises(MigrationError, match="migration_order_mismatch"):
            apply_migrations(conn, MIGRATIONS + (later,))


@pytest.mark.parametrize(
    "values",
    [
        ("tenant-x", "00000000-0000-4000-8000-000000000001", "PAT-X", 0),
        ("invalid tenant", "00000000-0000-4000-8000-000000000001", "PAT-X", 1),
        ("tenant-x", "00000000-0000-4000-8000-000000000001", "invalid patient", 1),
    ],
)
def test_case_constraints_reject_invalid_rows(isolated_database, values):
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, MIGRATIONS)
        with pytest.raises(psycopg.errors.CheckViolation), conn.transaction():
            conn.execute(
                "INSERT INTO clearauth_cases "
                "(tenant_id, case_id, patient_ref, revision) VALUES (%s, %s, %s, %s)",
                values,
            )
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (0,)
