"""Database safety/configuration checks run without a database."""

import pytest

from storage.config import (
    DatabaseConfig,
    DatabaseConfigurationError,
    load_database_config,
    verify_database_identity,
)

APP_URL = "postgresql://test-user:synthetic-secret@127.0.0.1:55432/clearauth_integration"
TEST_URL = "postgresql://test-user:synthetic-secret@127.0.0.1:55432/clearauth_integration_tests"


@pytest.mark.parametrize("env,test", [({}, False), ({"DATABASE_URL": APP_URL}, True)])
def test_missing_explicit_url_fails_without_fallback(env, test):
    with pytest.raises(DatabaseConfigurationError):
        load_database_config(env, test=test)


@pytest.mark.parametrize(
    "value",
    [
        APP_URL.replace("127.0.0.1", "localhost"),
        APP_URL.replace("55432", "5432"),
        APP_URL + "?host=other",
        APP_URL.replace("clearauth_integration", "postgres"),
        "postgresql:///clearauth_integration",
        APP_URL.replace("55432", "invalid"),
    ],
)
def test_wrong_or_ambiguous_target_is_rejected(value):
    with pytest.raises(DatabaseConfigurationError) as exc:
        load_database_config({"DATABASE_URL": value})
    assert "synthetic-secret" not in str(exc.value)


def test_test_url_cannot_name_the_application_database():
    with pytest.raises(DatabaseConfigurationError):
        load_database_config({"TEST_DATABASE_URL": APP_URL}, test=True)


def test_explicit_test_config_and_password_redaction():
    config = load_database_config({"TEST_DATABASE_URL": TEST_URL}, test=True)
    assert config.database == "clearauth_integration_tests"
    assert "synthetic-secret" not in repr(config)
    verify_database_identity(config, "clearauth_integration_tests", "180007")


@pytest.mark.parametrize(
    "database,version", [("postgres", "180007"), ("clearauth_integration", "160006")]
)
def test_wrong_database_or_server_version_fails(database, version):
    config = load_database_config({"DATABASE_URL": APP_URL})
    with pytest.raises(DatabaseConfigurationError):
        verify_database_identity(config, database, version)


@pytest.mark.parametrize(
    "changes",
    [
        {"host": "localhost"},
        {"port": 5432},
        {"database": "postgres"},
        {"database": "clearauth_integration_test/other"},
        {"user": ""},
        {"password": "bad\x00secret"},
    ],
)
def test_direct_construction_cannot_bypass_target_guards(changes):
    values = dict(
        database="clearauth_integration", user="fake", password="fake", host="127.0.0.1", port=55432
    )
    with pytest.raises(DatabaseConfigurationError):
        DatabaseConfig(**(values | changes))


@pytest.mark.parametrize(
    "value",
    [
        TEST_URL.replace("synthetic-secret", "bad%00secret"),
        TEST_URL.replace("test-user", "bad%0Auser"),
        TEST_URL + "%2Fother",
    ],
)
def test_decoded_control_characters_and_invalid_test_names_fail(value):
    with pytest.raises(DatabaseConfigurationError):
        load_database_config({"TEST_DATABASE_URL": value}, test=True)


def test_test_database_name_is_at_most_63_ascii_bytes():
    prefix = "clearauth_integration_test"
    assert len(prefix) == 26
    name = prefix + "a" * 37
    assert len(name.encode("ascii")) == 63
    value = TEST_URL.rsplit("/", 1)[0] + "/" + name
    assert load_database_config({"TEST_DATABASE_URL": value}, test=True).database == name
    with pytest.raises(DatabaseConfigurationError):
        load_database_config({"TEST_DATABASE_URL": value + "a"}, test=True)
