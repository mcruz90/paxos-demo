"""Durable sequence allocation, replay and rollback on the real isolated database."""

import pytest
from psycopg.errors import GeneratedAlways

from models.schemas import CaseCreateRequest
from storage.case_repository import CaseRepository
from storage.migrate import apply_migrations
from tests.integration.test_case_repository import COMMAND, GRANT
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_postgres_foundation import MIGRATIONS, connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres


def test_sequence_is_durable_and_replay_does_not_allocate_an_event(store_target):
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        first = repo.create_case(GRANT, COMMAND)
        original = repo.events_for_case(GRANT, first.case_id)[0]
        assert original.event_sequence > 0
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        assert repo.create_case(GRANT, COMMAND) == first
        assert repo.events_for_case(GRANT, first.case_id) == (original,)
        second = repo.create_case(GRANT, CaseCreateRequest(idempotency_key="second"))
        assert (
            repo.events_for_case(GRANT, second.case_id)[0].event_sequence > original.event_sequence
        )


def test_rolled_back_sequence_is_never_reused(store_target):
    with pytest.raises(RuntimeError, match="rollback"):
        with connection_for(store_target) as conn:
            repo = CaseRepository(conn)
            case = repo.create_case(GRANT, COMMAND)
            abandoned = repo.events_for_case(GRANT, case.case_id)[0].event_sequence
            raise RuntimeError("rollback")
    with connection_for(store_target) as conn:
        repo = CaseRepository(conn)
        assert repo.read_case(GRANT, case.case_id) is None
        retry = repo.create_case(GRANT, COMMAND)
        assert repo.events_for_case(GRANT, retry.case_id)[0].event_sequence > abandoned


def test_sequence_cannot_be_supplied_by_normal_insert(store_target):
    with connection_for(store_target) as conn:
        case = CaseRepository(conn).create_case(GRANT, COMMAND)
        with pytest.raises(GeneratedAlways), conn.transaction():
            conn.execute(
                "INSERT INTO clearauth_case_events "
                "(tenant_id,event_id,case_id,actor_id,action,case_revision,idempotency_key,event_sequence) "
                "VALUES (%s,'injected',%s,'staff-y','case_created',1,'injected',9000)",
                (GRANT.tenant_id, case.case_id),
            )


def test_upgrade_preserves_existing_case_event(isolated_database):
    before_sequence = tuple(m for m in MIGRATIONS if m.version < "0003")
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, before_sequence)
        case = CaseRepository(conn).create_case(GRANT, COMMAND)
    with connection_for(isolated_database) as conn:
        apply_migrations(conn, MIGRATIONS)
        repo = CaseRepository(conn)
        assert repo.create_case(GRANT, COMMAND) == case
        event = repo.events_for_case(GRANT, case.case_id)[0]
        assert event.event_sequence > 0
        assert event.case_revision == 1
