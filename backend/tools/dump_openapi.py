"""tools/dump_openapi.py — dump the app's OpenAPI schema to a checked-in file.

The frontend generates its TypeScript wire types from this document
(ADR-0012). FastAPI derives it from the Pydantic models, so Pydantic stays the
single authored source of truth and the TypeScript types are a build product
that cannot drift from the backend contract without CI catching it.

This calls ``app.openapi()`` directly — no server boot, no network, no LLM
backend selection — so it runs in CI and offline. The custom ``app.openapi``
(see ``openapi_ext``) registers the SSE event shapes that a StreamingResponse
route would otherwise hide.

Determinism: the output is written with sorted keys so a regenerated dump
diffs cleanly against the committed one. The freshness guard (CI) regenerates
and fails on any diff — the same drift-gate philosophy as the anchor-join
parity guard.

Run from backend/:
    uv run python -m tools.dump_openapi          # writes ../openapi.json
    uv run python -m tools.dump_openapi --stdout # prints instead of writing
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from main import app

# backend/tools/dump_openapi.py -> parents[2] == repo root
_REPO_ROOT = Path(__file__).resolve().parents[2]
_OUTPUT_PATH = _REPO_ROOT / "openapi.json"


def render() -> str:
    """Return the OpenAPI document as a deterministic, sorted-key JSON string."""
    schema = app.openapi()
    # sort_keys makes the dump reproducible so diffs are reviewable; trailing
    # newline keeps it a well-formed text file (and a clean git diff).
    return json.dumps(schema, indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    rendered = render()
    if "--stdout" in argv:
        sys.stdout.write(rendered)
        return
    _OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    # Status goes to stderr so `--stdout` stays pipe-clean.
    print(f"wrote {_OUTPUT_PATH.relative_to(_REPO_ROOT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
