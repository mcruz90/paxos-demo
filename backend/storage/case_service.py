"""Case transaction orchestration: authorize, perform I/O, commit, then return."""

from collections.abc import Iterator
from contextlib import contextmanager

from models.schemas import CaseAccess, CaseCreateRequest, CaseEventRecord, CaseIdentity, CaseRecord
from storage.case_authorization import CaseAccessDenied, resolve_case_access
from storage.case_repository import CaseRepository
from storage.config import DatabaseConfig
from storage.connection import checked_connection


class CaseService:
    def __init__(self, config: DatabaseConfig, identity: CaseIdentity):
        self.config = config
        self.identity = identity

    @contextmanager
    def _authorized(self, patient_ref: str) -> Iterator[tuple[CaseRepository, CaseAccess]]:
        with checked_connection(self.config) as conn:
            grant = resolve_case_access(conn, self.identity, patient_ref)
            yield CaseRepository(conn), grant

    def create(self, patient_ref: str, command: CaseCreateRequest) -> CaseRecord:
        with self._authorized(patient_ref) as (repo, grant):
            result = repo.create_case(grant, command)
        # The connection context has committed successfully before this return.
        return result

    def read(self, patient_ref: str, case_id: str) -> CaseRecord:
        with self._authorized(patient_ref) as (repo, grant):
            result = repo.read_case(grant, case_id)
            if result is None:
                raise CaseAccessDenied()
        return result

    def events(self, patient_ref: str, case_id: str) -> tuple[CaseEventRecord, ...]:
        with self._authorized(patient_ref) as (repo, grant):
            if repo.read_case(grant, case_id) is None:
                raise CaseAccessDenied()
            result = repo.events_for_case(grant, case_id)
        return result
