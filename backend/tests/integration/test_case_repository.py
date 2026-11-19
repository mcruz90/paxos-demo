"""Real case-store behavior with server-generated UUIDv4 ids; neutral records."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import UUID

import pytest
from psycopg import sql
from psycopg.pq import TransactionStatus

from cases.store_errors import CaseConflict, CaseStoreError
from models.schemas import CaseAccess, CaseCreateRequest
from storage.case_repository import CaseRepository
from storage.migrate import apply_migrations
from tests.integration.test_postgres_foundation import MIGRATIONS, connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres
GRANT = CaseAccess(tenant_id="tenant-x", patient_ref="PAT-X", actor_id="staff-x")
COMMAND = CaseCreateRequest(idempotency_key="request-x")


@pytest.fixture
def store_target(isolated_database):
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, MIGRATIONS)
    return isolated_database


def test_create_replay_read_and_event_survive_reconnect(store_target):
    with connection_for(store_target) as conn:
        types = conn.execute(
            "SELECT table_name, udt_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND column_name = 'case_id' "
            "AND table_name IN ('clearauth_cases', 'clearauth_case_events') ORDER BY table_name"
        ).fetchall()
        assert types == [("clearauth_case_events", "uuid"), ("clearauth_cases", "uuid")]
        first = CaseRepository(conn).create_case(GRANT, COMMAND)
        assert UUID(first.case_id).version == 4
        assert first.revision == 1
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        assert repo.create_case(GRANT, COMMAND) == first
        assert repo.read_case(GRANT, first.case_id) == first
        events = repo.events_for_case(GRANT, first.case_id)
        assert len(events) == 1
        assert events[0].actor_id == "staff-x"
        assert events[0].case_id == first.case_id
        assert events[0].case_revision == 1
        assert events[0].action == "case_created"
        assert events[0].occurred_at.tzinfo is not None


@pytest.mark.parametrize("field,value", [("tenant_id", "tenant-y"), ("patient_ref", "PAT-Y")])
def test_case_and_events_are_hidden_outside_patient_scope(store_target, field, value):
    other = CaseAccess.model_validate(GRANT.model_dump() | {field: value})
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        assert repo.read_case(other, first.case_id) is None
        assert repo.events_for_case(other, first.case_id) == ()


def test_same_key_cannot_create_for_a_different_patient(store_target):
    other = CaseAccess.model_validate(GRANT.model_dump() | {"patient_ref": "PAT-Y"})
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        with pytest.raises(CaseConflict, match="idempotency_conflict"):
            repo.create_case(other, COMMAND)
        assert len(repo.events_for_case(GRANT, first.case_id)) == 1


def test_new_key_creates_a_distinct_uuid_and_preserves_original_case(store_target):
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        second = repo.create_case(GRANT, CaseCreateRequest(idempotency_key="request-y"))
        assert UUID(first.case_id).version == UUID(second.case_id).version == 4
        assert first.case_id != second.case_id
        assert repo.read_case(GRANT, first.case_id) == first
        assert len(repo.events_for_case(GRANT, second.case_id)) == 1


def test_failure_writing_audit_rolls_back_case(store_target):
    with connection_for(store_target) as conn:
        conn.execute(
            "CREATE FUNCTION reject_event() RETURNS trigger LANGUAGE plpgsql AS "
            "$$ BEGIN RAISE EXCEPTION 'sensitive-synthetic-detail'; END $$"
        )
        conn.execute(
            "CREATE TRIGGER reject_event BEFORE INSERT ON clearauth_case_events "
            "FOR EACH ROW EXECUTE FUNCTION reject_event()"
        )
    with connection_for(store_target) as conn:
        with pytest.raises(CaseStoreError, match="^case_write_failed$") as exc:
            CaseRepository(conn).create_case(GRANT, COMMAND)
        assert "sensitive-synthetic-detail" not in str(exc.value)
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (0,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (0,)


def test_outer_transaction_failure_leaves_no_case_or_event(store_target):
    with pytest.raises(RuntimeError, match="cancelled"):
        with connection_for(store_target) as conn:
            first = CaseRepository(conn).create_case(GRANT, COMMAND)
            raise RuntimeError("cancelled")
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        assert repo.read_case(GRANT, first.case_id) is None
        assert repo.events_for_case(GRANT, first.case_id) == ()


def test_concurrent_same_request_returns_one_case_and_event(store_target):
    barrier = Barrier(2)

    def run():
        with connection_for(store_target) as conn:
            barrier.wait(timeout=5)
            return CaseRepository(conn).create_case(GRANT, COMMAND)

    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(lambda _: run(), range(2)))
    assert records[0] == records[1]
    with connection_for(store_target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (1,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (1,)


def test_creation_retry_returns_original_revision_after_case_changes(store_target):
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        original = repo.create_case(GRANT, COMMAND)
        conn.execute("UPDATE clearauth_cases SET revision = 2")
        assert repo.create_case(GRANT, COMMAND) == original
        assert repo.read_case(GRANT, original.case_id).revision == 2
        assert len(repo.events_for_case(GRANT, original.case_id)) == 1


def test_tenants_have_independent_request_keys(store_target):
    other = CaseAccess.model_validate(GRANT.model_dump() | {"tenant_id": "tenant-y"})
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        second = repo.create_case(other, COMMAND)
        assert first.tenant_id != second.tenant_id
        assert first.case_id != second.case_id
        assert len(repo.events_for_case(GRANT, first.case_id)) == 1
        assert len(repo.events_for_case(other, second.case_id)) == 1


def test_actors_have_independent_request_keys(store_target):
    other = CaseAccess.model_validate(GRANT.model_dump() | {"actor_id": "staff-y"})
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        second = repo.create_case(other, COMMAND)
        assert first.case_id != second.case_id


def test_invalid_stored_record_is_not_returned(store_target):
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        conn.execute("ALTER TABLE clearauth_cases DROP CONSTRAINT clearauth_cases_revision_check")
        conn.execute("UPDATE clearauth_cases SET revision = 0")
        with pytest.raises(CaseStoreError, match="^stored_case_invalid$"):
            repo.read_case(GRANT, first.case_id)


@pytest.mark.parametrize("autocommit", [False, True])
def test_create_requires_existing_outer_transaction_after_commit(store_target, autocommit):
    with connection_for(store_target) as conn:
        conn.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(store_target[1])))
        conn.commit()
        conn.autocommit = autocommit
        assert conn.info.transaction_status == TransactionStatus.IDLE
        with pytest.raises(CaseStoreError, match="^outer_transaction_required$"):
            CaseRepository(conn).create_case(GRANT, COMMAND)
        assert conn.info.transaction_status == TransactionStatus.IDLE
    with connection_for(store_target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (0,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (0,)


def test_concurrent_different_keys_create_two_distinct_uuids(store_target):
    barrier = Barrier(2)

    def run(key):
        with connection_for(store_target) as conn:
            barrier.wait(timeout=5)
            return CaseRepository(conn).create_case(GRANT, CaseCreateRequest(idempotency_key=key))

    with ThreadPoolExecutor(max_workers=2) as pool:
        records = list(pool.map(run, ["request-x", "request-y"]))
    assert records[0].case_id != records[1].case_id
    assert all(UUID(record.case_id).version == 4 for record in records)
    with connection_for(store_target) as conn:
        assert conn.execute("SELECT count(*) FROM clearauth_cases").fetchone() == (2,)
        assert conn.execute("SELECT count(*) FROM clearauth_case_events").fetchone() == (2,)
