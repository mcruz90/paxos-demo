"""Case-row serialization and durable replay of attachment commands."""

from uuid import uuid4

from cases.store_errors import CaseConflict
from models.discovery import AttachmentRequest, CaseAttachment
from storage.discovery import _SCOPE, DiscoveryStore, required


def change_attachment(
    store: DiscoveryStore, body: AttachmentRequest, operation: str, target: str
) -> CaseAttachment:
    key = (*store.scope, store.actor, body.request_id)
    binding = (operation, target, body.expected_revision)
    prior = store.conn.execute(
        "SELECT operation,target_id::text,revision,attachment_id::text FROM discovery_receipts "
        "WHERE " + _SCOPE + " AND actor_id=%s AND request_id=%s",
        key,
    ).fetchone()
    if prior is not None:
        if prior[:3] != binding:
            raise CaseConflict("idempotency_conflict")
        return store.get_attachment(prior[3])
    store.check_revision(body.expected_revision)
    if operation == "attach":
        identifier = _attach(store, target)
    else:
        row = store.conn.execute(
            "UPDATE discovery_attachments SET removed=true WHERE "
            + _SCOPE
            + " AND attachment_id=%s AND NOT removed RETURNING attachment_id::text",
            (*store.scope, target),
        )
        identifier = required(row.fetchone())[0]
    store.conn.execute(
        "INSERT INTO discovery_receipts (tenant_id,patient_ref,case_id,actor_id,request_id,"
        "operation,target_id,revision,attachment_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (*key, *binding, identifier),
    )
    return store.get_attachment(identifier)


def _attach(store: DiscoveryStore, target: str) -> str:
    revision = store.conn.execute(
        "SELECT revision FROM discovery_results JOIN discovery_queries "
        "USING (tenant_id,patient_ref,case_id,query_id) WHERE " + _SCOPE + " AND result_id=%s",
        (*store.scope, target),
    )
    store.check_revision(required(revision.fetchone())[0])
    identifier = str(uuid4())
    store.conn.execute(
        "INSERT INTO discovery_attachments (tenant_id,patient_ref,case_id,attachment_id,"
        "result_id,actor_id) VALUES (%s,%s,%s,%s,%s,%s)",
        (*store.scope, identifier, target, store.actor),
    )
    return identifier
