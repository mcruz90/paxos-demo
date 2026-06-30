"""Coverage pool — loaded from backend/golden/coverage_pool.json.

Policy-faithful coverage assignments for the 3 golden-set anchors:
  ozempic_cigna              — commercial primary + Medicaid secondary (COB)
  livdelzi_cigna_hepatology  — commercial primary + commercial secondary (birthday-rule COB)
  esomeprazole_uhc_pediatric — single commercial (no COB)

To add a new anchor's coverage: append an entry to coverage_pool.json.
No Python edits required unless the schema changes.

CLOSED POOL — every member ID, BIN, and PCN that appears in synthetic corpus
files must be a member of POOL_COVERAGE_MEMBER_IDS, POOL_BINS, or POOL_PCNS
so the Phase 0.E compliance scan stays green by construction.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import TypeAdapter

from models.case_packet import CoverageInfo

_POOL_PATH = Path(__file__).parent.parent / "golden" / "coverage_pool.json"


class CoverageRecord(CoverageInfo):
    """Per-anchor entry in coverage_pool.json.

    Extends CoverageInfo with anchor_id so the loader can build the lookup table.
    The _note field in the JSON is silently ignored by Pydantic (extra fields
    allowed for forward compatibility with annotations).
    """

    anchor_id: str

    model_config = {"extra": "ignore"}


_adapter: TypeAdapter[list[CoverageRecord]] = TypeAdapter(list[CoverageRecord])


def _load_pool() -> list[CoverageRecord]:
    try:
        return _adapter.validate_json(_POOL_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(
            f"Cannot load coverage pool from {_POOL_PATH}: {exc}"
        ) from exc


_COVERAGE_POOL: list[CoverageRecord] = _load_pool()

_POOL_BY_ANCHOR: dict[str, CoverageRecord] = {
    rec.anchor_id: rec for rec in _COVERAGE_POOL
}


def load_coverage_pool() -> list[CoverageRecord]:
    """Return all coverage records (one per anchor)."""
    return _COVERAGE_POOL


def get_coverage(anchor_id: str) -> CoverageInfo:
    """Return the CoverageInfo for *anchor_id*.

    Raises KeyError with a clear message if the anchor_id is not in the pool.
    To add a new anchor: append an entry to backend/golden/coverage_pool.json.
    """
    try:
        return _POOL_BY_ANCHOR[anchor_id]
    except KeyError:
        known = sorted(_POOL_BY_ANCHOR)
        raise KeyError(
            f"No coverage found for anchor_id={anchor_id!r}. "
            f"Known anchor_ids: {known}. "
            f"Add an entry to {_POOL_PATH}."
        ) from None


# ---------------------------------------------------------------------------
# Closed allowlists for the Phase 0.E compliance scan.
# Every coverage-specific identifier that may appear in synthetic corpus files
# must be a member of one of these sets.
# ---------------------------------------------------------------------------

POOL_COVERAGE_MEMBER_IDS: frozenset[str] = frozenset(
    member_id
    for rec in _COVERAGE_POOL
    for member_id in (
        rec.primary.member_id,
        *([] if rec.secondary is None else [rec.secondary.member_id]),
    )
)

POOL_BINS: frozenset[str] = frozenset(
    bin_
    for rec in _COVERAGE_POOL
    for bin_ in (
        rec.primary.bin,
        *([] if rec.secondary is None else [rec.secondary.bin]),
    )
)

POOL_PCNS: frozenset[str] = frozenset(
    pcn
    for rec in _COVERAGE_POOL
    for pcn in (
        rec.primary.pcn,
        *([] if rec.secondary is None else [rec.secondary.pcn]),
    )
)
