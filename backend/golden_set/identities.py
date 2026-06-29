"""Fixed synthetic-identity pool for golden-set document generation.

Every name, date, ID, and address in this file is invented and has no
connection to any real person.  The pool is intentionally small (3 entries —
one per anchor) so Phase 0.E can exhaustively allowlist every PII-shaped
token that may appear in the synthetic corpus.

Adding entries: add a new PatientIdentity, bump the pool list, and update
the allowlists POOL_NAMES / POOL_MEMBER_IDS / POOL_NPIS below.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PatientIdentity:
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


IDENTITY_POOL: list[PatientIdentity] = [
    # index 0 — Ozempic/Cigna — adult T2DM patient, endocrinologist
    PatientIdentity(
        patient_name="Marcus T. Halverson",
        patient_dob="1972-03-14",
        patient_sex="M",
        member_id="CGN00123456",
        group_id="GRP-78001",
        patient_address="4821 Ridgecrest Drive, Columbus, OH 43215",
        prescriber_name="Dr. Priya Ananthakrishnan, MD",
        prescriber_npi="1234567890",
        prescriber_specialty="Endocrinology",
        prescriber_address="300 Commerce Way, Columbus, OH 43214",
        prescriber_phone="(614) 555-0177",
    ),
    # index 1 — Esomeprazole/UHC — pediatric GERD patient (age 7), pediatric GI
    PatientIdentity(
        patient_name="Jordan R. Peterman",
        patient_dob="2017-09-22",
        patient_sex="M",
        member_id="UHC88542190",
        group_id="GRP-40052",
        patient_address="112 Maple Terrace Lane, Raleigh, NC 27601",
        prescriber_name="Dr. Yolanda Ekwueme, MD",
        prescriber_npi="2345678901",
        prescriber_specialty="Pediatric Gastroenterology",
        prescriber_address="700 Pediatric Plaza, Raleigh, NC 27603",
        prescriber_phone="(919) 555-0244",
    ),
    # index 2 — Livdelzi/Cigna — adult PBC patient (female), hepatologist
    PatientIdentity(
        patient_name="Diane K. Rourke",
        patient_dob="1970-11-07",
        patient_sex="F",
        member_id="CGN00987654",
        group_id="GRP-78014",
        patient_address="29 Birchwood Court, Portland, OR 97201",
        prescriber_name="Dr. Samuel Okonkwo, MD",
        prescriber_npi="3456789012",
        prescriber_specialty="Hepatology",
        prescriber_address="1200 Medical Center Drive, Portland, OR 97239",
        prescriber_phone="(503) 555-0381",
    ),
]

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
        # Name fragments for substring scanning
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
