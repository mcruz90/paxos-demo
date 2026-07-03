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


def all_records() -> list[AuditRecord]:
    """Snapshot of the audit log (copy — callers cannot mutate the store)."""
    return list(_RECORDS)


def reset_audit_log() -> None:
    """Clear the log. Tests only — production resets only on restart."""
    _RECORDS.clear()
    _KEYS.clear()
