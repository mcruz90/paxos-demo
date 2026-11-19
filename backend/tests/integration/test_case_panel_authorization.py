"""Durable group panels and revocation locking; no mocked authorization store."""

import pytest
from psycopg.errors import ForeignKeyViolation, LockNotAvailable

from models.schemas import CaseIdentity
from storage.case_authorization import CaseAccessDenied, resolve_case_access
from storage.case_repository import CaseRepository
from tests.integration.test_case_access_api import seed_access
from tests.integration.test_case_repository import COMMAND
from tests.integration.test_case_repository import store_target as store_target
from tests.integration.test_postgres_foundation import connection_for
from tests.integration.test_postgres_foundation import isolated_database as isolated_database

pytestmark = pytest.mark.postgres
IDENTITY = CaseIdentity(tenant_id="tenant-x", subject_id="staff@example.test")


@pytest.fixture
def panel_target(store_target):
    with connection_for(store_target) as conn:
        seed_access(conn)
    return store_target


@pytest.mark.parametrize("role", ["coordinator", "clinician", "admin"])
def test_roles_require_membership_and_patient_assignment(panel_target, role):
    with connection_for(panel_target) as conn:
        conn.execute("UPDATE clearauth_case_principals SET role = %s", (role,))
        grant = resolve_case_access(conn, IDENTITY, "PAT-X")
        assert grant.actor_id == "staff-x"
        with pytest.raises(CaseAccessDenied):
            resolve_case_access(conn, IDENTITY, "PAT-Y")
        conn.execute("DELETE FROM clearauth_panel_members")
        with pytest.raises(CaseAccessDenied):
            resolve_case_access(conn, IDENTITY, "PAT-X")


def test_multiple_users_share_group_without_sharing_actor_identity(panel_target):
    with connection_for(panel_target) as conn:
        conn.execute(
            "INSERT INTO clearauth_case_principals "
            "(tenant_id,subject_id,actor_id,role,active) "
            "VALUES ('tenant-x','second','staff-y','clinician',true)"
        )
        conn.execute("INSERT INTO clearauth_panel_members VALUES ('tenant-x','group-x','staff-y')")
    with connection_for(panel_target) as conn:
        second = CaseIdentity(tenant_id="tenant-x", subject_id="second")
        grant = resolve_case_access(conn, second, "PAT-X")
        assert grant.actor_id == "staff-y"


def test_principals_start_inactive_and_members_cannot_borrow_other_tenant(panel_target):
    with connection_for(panel_target) as conn:
        conn.execute(
            "INSERT INTO clearauth_case_principals (tenant_id,subject_id,actor_id,role) "
            "VALUES ('tenant-y','staff@example.test','staff-y','admin')"
        )
        conn.execute("INSERT INTO clearauth_panel_groups VALUES ('tenant-y','group-y')")
        with pytest.raises(ForeignKeyViolation), conn.transaction():
            conn.execute(
                "INSERT INTO clearauth_panel_members VALUES ('tenant-y','group-y','staff-x')"
            )
        conn.execute("INSERT INTO clearauth_panel_members VALUES ('tenant-y','group-y','staff-y')")
        conn.execute("INSERT INTO clearauth_panel_patients VALUES ('tenant-y','group-y','PAT-X')")
        with pytest.raises(CaseAccessDenied):
            resolve_case_access(
                conn, CaseIdentity(tenant_id="tenant-y", subject_id=IDENTITY.subject_id), "PAT-X"
            )


@pytest.mark.parametrize("revocation", ["principal", "membership", "assignment"])
def test_revocation_is_serialized_after_admitted_case_transaction(panel_target, revocation):
    statements = {
        "principal": "UPDATE clearauth_case_principals SET active = false",
        "membership": "DELETE FROM clearauth_panel_members",
        "assignment": "DELETE FROM clearauth_panel_patients",
    }
    with connection_for(panel_target) as admitted:
        grant = resolve_case_access(admitted, IDENTITY, "PAT-X")
        with connection_for(panel_target) as revoker:
            # Fail quickly on the held shared row lock; production timeout is unchanged.
            revoker.execute("SET LOCAL lock_timeout = '100ms'")
            with pytest.raises(LockNotAvailable), revoker.transaction():
                revoker.execute(statements[revocation])
        created = CaseRepository(admitted).create_case(grant, COMMAND)
    with connection_for(panel_target) as revoker:
        revoker.execute(statements[revocation])
    with connection_for(panel_target) as later:
        with pytest.raises(CaseAccessDenied):
            resolve_case_access(later, IDENTITY, "PAT-X")
        assert later.execute("SELECT case_id::text FROM clearauth_cases").fetchone() == (
            created.case_id,
        )
