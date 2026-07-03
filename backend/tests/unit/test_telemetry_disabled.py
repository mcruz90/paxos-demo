"""Unit tests — LangSmith telemetry hard-disable (Sprint 2 Slice 0).

langsmith is a mandatory transitive dependency of langchain-core (pulled in by
LangGraph, ADR-0001). Its tracing uploads run payloads — which in this
pipeline contain denial-letter text — to LangChain's hosted SaaS whenever
LANGSMITH_TRACING / LANGCHAIN_TRACING_V2 is set. In a PHI codebase that must
be a deliberate code change, never an inherited env var: main.py force-sets
both vars to "false" at import, after load_dotenv().

This is the enforcement point paired with the dependency (detection without
enforcement is not a control — CLAUDE.md §Defensive Programming).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def test_importing_main_forces_langsmith_tracing_off() -> None:
    """Even when tracing env vars are pre-set on the host, importing main must
    override them to "false" — a stray env var on a deploy host must never
    silently ship PHI trace payloads to LangChain's SaaS."""
    code = (
        "import os; "
        "import main; "
        "print(os.environ['LANGSMITH_TRACING'], os.environ['LANGCHAIN_TRACING_V2'])"
    )
    env = {
        **os.environ,
        "LANGSMITH_TRACING": "true",
        "LANGCHAIN_TRACING_V2": "true",
    }
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == ["false", "false"]


def test_langsmith_tracing_reports_disabled() -> None:
    """Belt-and-braces: langsmith's own gate must report tracing disabled in
    the app process once main is imported."""
    from langsmith import utils

    import main  # noqa: F401  — triggers the hard-disable

    assert utils.tracing_is_enabled() is False
