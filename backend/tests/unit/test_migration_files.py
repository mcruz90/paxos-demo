"""Migration plan validation, without a database."""

import pytest

from storage.migration_files import MigrationError, load_migrations


def test_migrations_have_stable_checksums_and_numeric_order(tmp_path):
    (tmp_path / "0002_next.sql").write_text("SELECT 2;", encoding="utf-8")
    (tmp_path / "0001_first.sql").write_text("SELECT 1;", encoding="utf-8")
    migrations = load_migrations(tmp_path)
    assert [m.version for m in migrations] == ["0001", "0002"]
    assert all(len(m.sha256) == 64 for m in migrations)
    assert migrations[0].sha256 == load_migrations(tmp_path)[0].sha256
    (tmp_path / "0001_first.sql").write_text("SELECT 3;", encoding="utf-8")
    assert migrations[0].sha256 != load_migrations(tmp_path)[0].sha256


def test_duplicate_migration_versions_are_rejected(tmp_path):
    (tmp_path / "0001_one.sql").write_text("SELECT 1;", encoding="utf-8")
    (tmp_path / "0001_two.sql").write_text("SELECT 2;", encoding="utf-8")
    with pytest.raises(MigrationError, match="duplicate_migration_version"):
        load_migrations(tmp_path)


def test_empty_migration_is_rejected(tmp_path):
    (tmp_path / "0001_empty.sql").write_text("", encoding="utf-8")
    with pytest.raises(MigrationError, match="empty_migration"):
        load_migrations(tmp_path)
