"""Synthetic-identity pool — loaded from backend/golden/identities.json.

To add a new identity: append an entry to identities.json matching the
PatientIdentity fields.  No Python edits required.

Every name, date, ID, and address is invented — not derived from any real
person.  The pool is closed: Phase-0.E compliance asserts every PII-shaped
token in the corpus maps to an entry here.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from pydantic import TypeAdapter

_POOL_PATH = Path(__file__).parent.parent / "golden" / "identities.json"


@dataclass(frozen=True)
class PatientIdentity:
    anchor_id: str             # stable key — matches the seed's anchor_id
    patient_name: str
    patient_dob: str           # YYYY-MM-DD
    patient_sex: str           # "M" | "F"
    member_id: str
    group_id: str
    patient_address: str
    prescriber_name: str
    prescriber_npi: str        # 10-digit numeric string (fake)
    prescriber_specialty: str
    prescriber_address: str
    prescriber_phone: str


_adapter: TypeAdapter[list[PatientIdentity]] = TypeAdapter(list[PatientIdentity])


def _load_pool() -> list[PatientIdentity]:
    try:
        return _adapter.validate_json(_POOL_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(
            f"Cannot load identity pool from {_POOL_PATH}: {exc}"
        ) from exc


IDENTITY_POOL: list[PatientIdentity] = _load_pool()

_POOL_BY_ANCHOR: dict[str, PatientIdentity] = {
    ident.anchor_id: ident for ident in IDENTITY_POOL
}


def get_identity(anchor_id: str) -> PatientIdentity:
    """Return the PatientIdentity for *anchor_id*.

    Raises KeyError with a clear message if the anchor_id is not in the pool.
    To add a new identity: append an entry to backend/golden/identities.json.
    """
    try:
        return _POOL_BY_ANCHOR[anchor_id]
    except KeyError:
        known = sorted(_POOL_BY_ANCHOR)
        raise KeyError(
            f"No identity found for anchor_id={anchor_id!r}. "
            f"Known anchor_ids: {known}. "
            f"Add an entry to {_POOL_PATH}."
        ) from None


# ---------------------------------------------------------------------------
# Closed allowlists for the Phase 0.E compliance scan.
# Every PII-shaped token that may appear in synthetic corpus files must be
# a member of one of these sets.
# ---------------------------------------------------------------------------

POOL_NAMES: frozenset[str] = frozenset(
    token
    for ident in IDENTITY_POOL
    for token in (
        ident.patient_name,
        ident.prescriber_name,
        *ident.patient_name.split(),
        *ident.prescriber_name.replace("Dr. ", "").replace(", MD", "").split(),
    )
)

POOL_MEMBER_IDS: frozenset[str] = frozenset(
    ident.member_id for ident in IDENTITY_POOL
)

POOL_NPIS: frozenset[str] = frozenset(
    ident.prescriber_npi for ident in IDENTITY_POOL
)

POOL_DOBS: frozenset[str] = frozenset(
    ident.patient_dob for ident in IDENTITY_POOL
)
