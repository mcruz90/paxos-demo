"""audit/store.py — pre-DB in-memory audit log (CLAUDE.md ACID §Durability).

An in-process ``list[AuditRecord]`` that survives the request lifecycle and
resets only on server restart. Writes are idempotent on ``idempotency_key``.

Known limit (accepted pre-DB, per CLAUDE.md): an in-process list silently
shards under multiple uvicorn workers — do not build on it beyond this
sprint; PostgreSQL persistence replaces it (Phase 3, before `done` is
emitted, per §Durability).
"""

from __future__ import annotations

from models.schemas import AuditRecord
from security.tenancy import TenancyScope, record_in_scope

_RECORDS: list[AuditRecord] = []
_KEYS: set[str] = set()


def write_audit_record(record: AuditRecord) -> bool:
    """Append *record* unless its idempotency key was already written.

    Args:
        record: The completed-run record.

    Returns:
        True if appended; False if a record with the same idempotency key
        already exists (retried request — no double-write).
    """
    if record.idempotency_key in _KEYS:
        return False
    _KEYS.add(record.idempotency_key)
    _RECORDS.append(record)
    return True


def all_records(scope: TenancyScope) -> list[AuditRecord]:
    """Tenant-scoped snapshot of the audit log (copy — callers cannot mutate it).

    ``scope`` is the single fail-closed query boundary for audit reads (ADR-0017
    point 3): it is a REQUIRED positional argument, so a read path cannot be
    written that forgets the filter — no scope, no rows. A platform scope
    returns every row; a tenant scope returns only that tenant's; a scope with
    no resolved tenant returns nothing.
    """
    return [r for r in _RECORDS if record_in_scope(r.tenant_id, scope)]


def reset_audit_log() -> None:
    """Clear the log. Tests only — production resets only on restart."""
    _RECORDS.clear()
    _KEYS.clear()
