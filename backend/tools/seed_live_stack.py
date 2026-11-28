"""Provision the synthetic PT-4201 live fixture and print its UUID after commit."""

import os
from pathlib import Path
from uuid import UUID

from models.schemas import SEEDED_TENANT_ID, CaseCreateRequest, CaseIdentity
from storage.case_authorization import resolve_case_access
from storage.case_repository import CaseRepository
from storage.config import load_database_config
from storage.connection import checked_connection
from storage.migrate import apply_migrations
from storage.migration_files import load_migrations

CASE_ID = UUID("42010000-0000-4000-8000-000000000001")
PATIENT = "PT-4201"
ACTOR = "live-seed-reviewer"
GROUP = "live-seed-pediatric"


def main() -> None:
    config = load_database_config(os.environ)
    tenant = SEEDED_TENANT_ID
    identity = CaseIdentity(tenant_id=tenant, subject_id="reviewer")
    with checked_connection(config) as conn:
        apply_migrations(conn, load_migrations(Path(__file__).parents[1] / "storage/sql"))
        conn.execute(
            "INSERT INTO clearauth_case_principals (tenant_id,subject_id,actor_id,role,active) "
            "VALUES (%s,%s,%s,'coordinator',true) ON CONFLICT (tenant_id,subject_id) DO NOTHING",
            (tenant, identity.subject_id, ACTOR),
        )
        conn.execute(
            "INSERT INTO clearauth_panel_groups (tenant_id,group_id) VALUES (%s,%s) "
            "ON CONFLICT DO NOTHING",
            (tenant, GROUP),
        )
        conn.execute(
            "INSERT INTO clearauth_panel_members (tenant_id,group_id,actor_id) VALUES (%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            (tenant, GROUP, ACTOR),
        )
        conn.execute(
            "INSERT INTO clearauth_panel_patients (tenant_id,group_id,patient_ref) VALUES (%s,%s,%s) "
            "ON CONFLICT DO NOTHING",
            (tenant, GROUP, PATIENT),
        )
        scope = resolve_case_access(conn, identity, PATIENT)
        if scope.actor_id != ACTOR:
            raise SystemExit("reviewer already bound to another actor")
        repo = CaseRepository(conn, new_case_id=lambda: CASE_ID)
        case = repo.create_case(
            scope, CaseCreateRequest(idempotency_key="journey-anchor-pediatric")
        )
        if case.case_id != str(CASE_ID):
            raise SystemExit("journey create key already bound to another case")
    print(CASE_ID)


if __name__ == "__main__":
    main()
