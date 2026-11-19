"""Fail-closed local database configuration; no URL or credential logging."""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from urllib.parse import unquote, urlsplit


class DatabaseConfigurationError(ValueError):
    """Metadata-only failure suitable for startup diagnostics."""


@dataclass(frozen=True)
class DatabaseConfig:
    database: str
    user: str
    password: str = field(repr=False)
    host: str
    port: int

    def __post_init__(self) -> None:
        if self.host != "127.0.0.1" or self.port != 55432:
            raise DatabaseConfigurationError("invalid_local_endpoint")
        if self.database != "clearauth_integration" and not _is_test_database(self.database):
            raise DatabaseConfigurationError("invalid_local_database")
        if any(
            not value or any(ord(char) < 32 or ord(char) == 127 for char in value)
            for value in (self.user, self.password)
        ):
            raise DatabaseConfigurationError("invalid_database_credentials")


def _is_test_database(database: str) -> bool:
    return bool(re.fullmatch(r"clearauth_integration_test[a-z0-9_]{0,37}", database))


def load_database_config(env: Mapping[str, str], *, test: bool = False) -> DatabaseConfig:
    key = "TEST_DATABASE_URL" if test else "DATABASE_URL"
    value = env.get(key)
    if not value:
        raise DatabaseConfigurationError(f"{key}_required")
    try:
        return _parse_config(value, test)
    except (ValueError, UnicodeError):
        raise DatabaseConfigurationError(f"{key}_invalid_local_target") from None


def _parse_config(value: str, test: bool) -> DatabaseConfig:
    if any(ord(char) < 32 for char in value):
        raise ValueError("control_character")
    url = urlsplit(value)
    if url.scheme not in {"postgres", "postgresql"} or url.query or url.fragment:
        raise ValueError("unsupported_connection_options")
    if url.hostname != "127.0.0.1" or url.port != 55432 or not url.username or not url.password:
        raise ValueError("wrong_endpoint_or_missing_credentials")
    database = unquote(url.path.removeprefix("/"))
    if test:
        if not _is_test_database(database):
            raise ValueError("test_database_required")
    elif database != "clearauth_integration":
        raise ValueError("application_database_required")
    return DatabaseConfig(
        database, unquote(url.username), unquote(url.password), url.hostname, url.port
    )


def verify_database_identity(config: DatabaseConfig, database: str, version: str) -> None:
    if database != config.database or not version.isdecimal() or int(version) // 10000 != 18:
        raise DatabaseConfigurationError("database_identity_mismatch")
