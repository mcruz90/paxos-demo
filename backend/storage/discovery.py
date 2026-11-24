"""Transaction-local discovery snapshots, scoped by the authorized case row."""

from uuid import uuid4

import psycopg
from psycopg.types.json import Jsonb
from pydantic import TypeAdapter

from cases.discovery import DiscoveryAdapter
from cases.store_errors import CaseConflict
from models.case_evidence import CaseRecord
from models.discovery import CaseAttachment, DiscoveryItem, DiscoveryResults, DiscoverySearch
from models.schemas import CaseAccess
from storage.case_authorization import CaseAccessDenied

_ITEM: TypeAdapter[DiscoveryItem] = TypeAdapter(DiscoveryItem)
_SCOPE = "tenant_id=%s AND patient_ref=%s AND case_id=%s"
_ATTACHMENT = (
    """
SELECT attachment_id::text, result_id::text, source, actor_id, attached_at
FROM discovery_attachments JOIN discovery_results USING (tenant_id,patient_ref,case_id,result_id)
WHERE """
    + _SCOPE
)


def required(row):
    if row is None:
        raise CaseAccessDenied()
    return row


def attachment(row) -> CaseAttachment:
    identifier, result_id, source, actor, timestamp = row
    return CaseAttachment(
        attachment_id=identifier,
        item=_ITEM.validate_python(source | {"result_id": result_id}),
        actor_id=actor,
        attached_at=timestamp,
    )


class DiscoveryStore:
    def __init__(self, conn: psycopg.Connection, grant: CaseAccess, case_id: str, write: bool):
        self.conn = conn
        self.actor = grant.actor_id
        self.scope = (grant.tenant_id, grant.patient_ref, case_id)
        lock = " FOR UPDATE" if write else ""
        row = conn.execute(
            "SELECT revision FROM clearauth_cases WHERE " + _SCOPE + lock, self.scope
        )
        self.case = CaseRecord(
            tenant_id=grant.tenant_id,
            patient_ref=grant.patient_ref,
            case_id=case_id,
            revision=required(row.fetchone())[0],
        )

    def check_revision(self, revision: int) -> None:
        if self.case.revision != revision:
            raise CaseConflict("stale_case_revision")

    def search(self, body: DiscoverySearch, adapter: DiscoveryAdapter) -> DiscoveryResults:
        self.check_revision(body.expected_revision)
        query_id = str(uuid4())
        self.conn.execute(
            "INSERT INTO discovery_queries (tenant_id,patient_ref,case_id,query_id,query,revision) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (*self.scope, query_id, body.query, self.case.revision),
        )
        for ordinal, source in enumerate(adapter.search(self.case, body.query)):
            self.conn.execute(
                "INSERT INTO discovery_results (tenant_id,patient_ref,case_id,query_id,result_id,"
                "ordinal,source) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (*self.scope, query_id, uuid4(), ordinal, Jsonb(source.model_dump())),
            )
        return self.results(query_id)

    def results(self, query_id: str) -> DiscoveryResults:
        args = (*self.scope, query_id)
        query, revision = required(
            self.conn.execute(
                "SELECT query,revision FROM discovery_queries WHERE " + _SCOPE + " AND query_id=%s",
                args,
            ).fetchone()
        )
        rows = self.conn.execute(
            "SELECT result_id::text,source FROM discovery_results WHERE "
            + _SCOPE
            + " AND query_id=%s ORDER BY ordinal",
            args,
        )
        return DiscoveryResults(
            query_id=query_id,
            query=query,
            revision=revision,
            items=tuple(_ITEM.validate_python(source | {"result_id": rid}) for rid, source in rows),
        )

    def attachments(self) -> tuple[CaseAttachment, ...]:
        rows = self.conn.execute(
            _ATTACHMENT + " AND NOT removed ORDER BY attached_at,attachment_id", self.scope
        )
        return tuple(map(attachment, rows))

    def get_attachment(self, identifier: str) -> CaseAttachment:
        row = self.conn.execute(_ATTACHMENT + " AND attachment_id=%s", (*self.scope, identifier))
        return attachment(required(row.fetchone()))
