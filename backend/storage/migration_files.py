"""Trusted local migration files, validated and hashed without database I/O."""

import re
from dataclasses import dataclass, field
from hashlib import sha256
from pathlib import Path


class MigrationError(RuntimeError):
    """Metadata-only migration failure."""


@dataclass(frozen=True)
class Migration:
    version: str
    sha256: str
    sql: str = field(repr=False)


def load_migrations(folder: Path) -> tuple[Migration, ...]:
    if not folder.is_dir():
        raise MigrationError("migration_directory_missing")
    result: list[Migration] = []
    seen = set()
    for path in sorted(folder.glob("*.sql")):
        match = re.fullmatch(r"(\d{4})_[a-z0-9_]+\.sql", path.name)
        if match is None:
            raise MigrationError("invalid_migration_filename")
        version = match[1]
        if version in seen:
            raise MigrationError("duplicate_migration_version")
        seen.add(version)
        if path.stat().st_size > 1000000:
            raise MigrationError("migration_too_large")
        body = path.read_bytes()
        if not body.strip():
            raise MigrationError("empty_migration")
        result.append(Migration(version, sha256(body).hexdigest(), body.decode("utf-8")))
    if not result:
        raise MigrationError("migration_set_empty")
    return tuple(result)
