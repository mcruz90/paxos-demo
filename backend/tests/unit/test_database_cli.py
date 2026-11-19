"""Migration commands must fail without explicit configuration before doing I/O."""

import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("args,key", [((), "DATABASE_URL"), (("--test",), "TEST_DATABASE_URL")])
def test_migration_cli_has_no_connection_default(args, key):
    env = {
        key: value
        for key, value in os.environ.items()
        if key not in {"DATABASE_URL", "TEST_DATABASE_URL"}
    }
    result = subprocess.run(
        [sys.executable, "-m", "storage.migrate", *args],
        cwd=Path(__file__).parents[2],
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert result.returncode != 0
    assert result.stderr.strip() == key + "_required"
    assert not result.stdout
