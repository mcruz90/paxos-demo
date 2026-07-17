"""Tests for 0.C synthetic-document generation pipeline.

TDD red phase: these tests fail until the golden_set generation modules are implemented.
All tests are deterministic, LLM-free, and network-free.

Run from backend/:
    uv run pytest tests/unit/test_golden_generator.py -v
"""

from __future__ import annotations

import pytest

# These imports fail (ImportError) until 0.C implementation is in place — intentional.
from golden_set.documents import GeneratedDocuments, generate_documents
from golden_set.identities import IDENTITY_POOL, get_identity
from golden_set.markers import SYNTHETIC_MARKER
from golden_set.pdf import render_denial_letter_pdf
from golden_set.seeds import PROFILES, SEEDS

# ── DETERMINISM ───────────────────────────────────────────────────────────────


def test_determinism_denial_letter_ozempic() -> None:
    """Same seed + profile ⇒ byte-identical denial letter (Ozempic/Cigna)."""
    seed = SEEDS["ozempic_cigna"]
    profile = PROFILES["ozempic_cigna"]
    assert generate_documents(seed, profile).denial_letter_text == generate_documents(seed, profile).denial_letter_text


def test_determinism_denial_letter_esomeprazole() -> None:
    """Determinism — esomeprazole/UHC anchor."""
    seed = SEEDS["esomeprazole_uhc_pediatric"]
    profile = PROFILES["esomeprazole_uhc_pediatric"]
    assert generate_documents(seed, profile).denial_letter_text == generate_documents(seed, profile).denial_letter_text


def test_determinism_denial_letter_livdelzi() -> None:
    """Determinism — Livdelzi/Cigna anchor."""
    seed = SEEDS["livdelzi_cigna_hepatology"]
    profile = PROFILES["livdelzi_cigna_hepatology"]
    assert generate_documents(seed, profile).denial_letter_text == generate_documents(seed, profile).denial_letter_text


def test_determinism_clinical_snippets_ozempic() -> None:
    """Clinical snippets are byte-identical across two calls (Ozempic)."""
    seed, profile = SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"]
    assert generate_documents(seed, profile).clinical_snippets == generate_documents(seed, profile).clinical_snippets


def test_determinism_rx_snippet_ozempic() -> None:
    """Rx snippet is byte-identical across two calls (Ozempic)."""
    seed, profile = SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"]
    assert generate_documents(seed, profile).rx_snippet == generate_documents(seed, profile).rx_snippet


# ── GROUNDING — core fields ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "anchor_id,drug_fragment",
    [
        ("ozempic_cigna", "ozempic"),
        ("esomeprazole_uhc_pediatric", "esomeprazole"),
        ("livdelzi_cigna_hepatology", "livdelzi"),
    ],
)
def test_grounding_drug_in_denial_letter(anchor_id: str, drug_fragment: str) -> None:
    """Drug name must appear (case-insensitive) in the denial letter."""
    doc = generate_documents(SEEDS[anchor_id], PROFILES[anchor_id])
    assert drug_fragment in doc.denial_letter_text.lower()


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_grounding_plan_id_in_denial_letter(anchor_id: str) -> None:
    """Plan ID from seed must appear verbatim in the denial letter."""
    seed = SEEDS[anchor_id]
    doc = generate_documents(seed, PROFILES[anchor_id])
    assert seed.plan_id in doc.denial_letter_text


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_grounding_denial_reason_in_denial_letter(anchor_id: str) -> None:
    """Denial reason from seed must appear verbatim in the denial letter."""
    seed = SEEDS[anchor_id]
    doc = generate_documents(seed, PROFILES[anchor_id])
    assert seed.denial_reason in doc.denial_letter_text


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_grounding_icd_code_in_denial_letter(anchor_id: str) -> None:
    """ICD-10 code from seed must appear verbatim in the denial letter."""
    seed = SEEDS[anchor_id]
    doc = generate_documents(seed, PROFILES[anchor_id])
    assert seed.icd_code in doc.denial_letter_text


# ── GROUNDING — per-criterion evidence ───────────────────────────────────────


def test_grounding_met_criteria_have_evidence_ozempic() -> None:
    """Each 'met' criterion label must appear in at least one clinical snippet (Ozempic)."""
    seed, profile = SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"]
    doc = generate_documents(seed, profile)
    met = [c for c in profile.criteria if c.status == "met"]
    assert met, "ozempic profile must have at least one 'met' criterion"
    for crit in met:
        assert any(crit.label in s for s in doc.clinical_snippets), (
            f"No clinical snippet found for met criterion: {crit.label!r}"
        )


def test_grounding_needs_review_criteria_flagged_ozempic() -> None:
    """Each 'needs_review' criterion label must appear in at least one snippet (Ozempic)."""
    seed, profile = SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"]
    doc = generate_documents(seed, profile)
    nr = [c for c in profile.criteria if c.status == "needs_review"]
    assert nr, "ozempic profile must have at least one 'needs_review' criterion"
    for crit in nr:
        assert any(crit.label in s for s in doc.clinical_snippets), (
            f"No clinical snippet found for needs_review criterion: {crit.label!r}"
        )


def test_grounding_conflict_criterion_has_two_sources() -> None:
    """'conflict' criteria must appear in a snippet that contains 'Source 1:'."""
    seed, profile = SEEDS["esomeprazole_uhc_pediatric"], PROFILES["esomeprazole_uhc_pediatric"]
    doc = generate_documents(seed, profile)
    conflicts = [c for c in profile.criteria if c.status == "conflict"]
    assert conflicts, "esomeprazole profile must have at least one 'conflict' criterion"
    for crit in conflicts:
        matching = [s for s in doc.clinical_snippets if crit.label in s]
        assert matching, f"No snippet for conflict criterion: {crit.label!r}"
        assert "Source 1:" in matching[0], (
            f"Conflict snippet for {crit.label!r} is missing 'Source 1:'"
        )


def test_grounding_livdelzi_needs_review_udca() -> None:
    """Livdelzi profile needs_review criterion (UDCA duration) grounded in snippets."""
    seed, profile = SEEDS["livdelzi_cigna_hepatology"], PROFILES["livdelzi_cigna_hepatology"]
    doc = generate_documents(seed, profile)
    nr = [c for c in profile.criteria if c.status == "needs_review"]
    assert nr, "livdelzi profile must have at least one 'needs_review' criterion"
    for crit in nr:
        assert any(crit.label in s for s in doc.clinical_snippets)


# ── PDF ROUND-TRIP ────────────────────────────────────────────────────────────


def test_pdf_render_produces_valid_pdf_bytes() -> None:
    """render_denial_letter_pdf must return bytes starting with the PDF magic bytes."""
    doc = generate_documents(SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"])
    pdf_bytes = render_denial_letter_pdf(doc.denial_letter_text)
    assert pdf_bytes[:4] == b"%PDF", "Output is not a valid PDF"


def test_pdf_round_trip_etl_extracts_drug() -> None:
    """process_denial_letter() must extract 'ozempic' from the generated PDF."""
    from etl.denial_letter.pipeline import process_denial_letter

    doc = generate_documents(SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"])
    pdf_bytes = render_denial_letter_pdf(doc.denial_letter_text)
    ar = process_denial_letter(pdf_bytes, "synthetic_ozempic.pdf")
    assert "ozempic" in ar.drug.lower(), (
        f"ETL did not extract 'ozempic'; got drug={ar.drug!r}"
    )


def test_pdf_round_trip_etl_extracts_denial_text() -> None:
    """process_denial_letter() denial_text must contain the seeded denial_reason.

    Word-wrapping in the PDF renderer inserts newlines that break exact substring
    matching.  Normalize all whitespace (collapse newlines + spaces) before comparison
    so the test verifies content presence, not line-layout fidelity.
    """
    from etl.denial_letter.pipeline import process_denial_letter

    seed = SEEDS["ozempic_cigna"]
    doc = generate_documents(seed, PROFILES["ozempic_cigna"])
    pdf_bytes = render_denial_letter_pdf(doc.denial_letter_text)
    ar = process_denial_letter(pdf_bytes, "synthetic_ozempic.pdf")
    # Normalize whitespace: word-wrapping in the PDF may break the denial_reason
    # into multiple lines; collapse all whitespace before substring comparison.
    denial_text_flat = " ".join(ar.denial_text.split())
    reason_flat = " ".join(seed.denial_reason.split())
    assert reason_flat in denial_text_flat, (
        "Seeded denial_reason (whitespace-normalized) not found in extracted denial_text"
    )


# ── POOL-ONLY IDENTITIES ──────────────────────────────────────────────────────


def test_identity_pool_has_four_entries() -> None:
    """IDENTITY_POOL must have exactly 4 entries — one per golden anchor.

    Anchors: ozempic_cigna, esomeprazole_uhc_pediatric, livdelzi_cigna_hepatology,
    humira_cigna. The first three are seed-generated (SEEDS/PROFILES); humira_cigna
    is a policy-anchored appeal case (authored fixture, no generator seed).
    """
    assert len(IDENTITY_POOL) == 4


def test_identity_pool_all_required_fields_present() -> None:
    """Every identity in IDENTITY_POOL must have all required non-empty fields."""
    required_fields = [
        "patient_name", "patient_dob", "patient_sex", "member_id", "group_id",
        "patient_address", "prescriber_name", "prescriber_npi",
        "prescriber_specialty", "prescriber_address", "prescriber_phone",
    ]
    for i, ident in enumerate(IDENTITY_POOL):
        for field in required_fields:
            val = getattr(ident, field)
            assert val, f"IDENTITY_POOL[{i}].{field} is empty"


def test_identity_pool_npi_is_ten_digits() -> None:
    """Every prescriber NPI must be a 10-digit numeric string."""
    for i, ident in enumerate(IDENTITY_POOL):
        assert ident.prescriber_npi.isdigit(), (
            f"IDENTITY_POOL[{i}].prescriber_npi {ident.prescriber_npi!r} is not all digits"
        )
        assert len(ident.prescriber_npi) == 10, (
            f"IDENTITY_POOL[{i}].prescriber_npi has {len(ident.prescriber_npi)} digits, expected 10"
        )


def test_pool_patient_name_in_generated_denial_letter() -> None:
    """Patient name from pool must appear verbatim in the generated denial letter."""
    for anchor_id, seed in SEEDS.items():
        expected_name = get_identity(anchor_id).patient_name
        doc = generate_documents(seed, PROFILES[anchor_id])
        assert expected_name in doc.denial_letter_text, (
            f"Patient name {expected_name!r} not found in denial letter for {anchor_id}"
        )


def test_pool_member_id_in_generated_denial_letter() -> None:
    """Member ID from pool must appear verbatim in the generated denial letter."""
    for anchor_id, seed in SEEDS.items():
        expected_id = get_identity(anchor_id).member_id
        doc = generate_documents(seed, PROFILES[anchor_id])
        assert expected_id in doc.denial_letter_text, (
            f"Member ID {expected_id!r} not found in denial letter for {anchor_id}"
        )


def test_pool_prescriber_npi_in_generated_denial_letter() -> None:
    """Prescriber NPI from pool must appear in the generated denial letter."""
    for anchor_id, seed in SEEDS.items():
        expected_npi = get_identity(anchor_id).prescriber_npi
        doc = generate_documents(seed, PROFILES[anchor_id])
        assert expected_npi in doc.denial_letter_text, (
            f"Prescriber NPI {expected_npi!r} not found in denial letter for {anchor_id}"
        )


# ── PATIENT CONTEXT ON GeneratedDocuments ─────────────────────────────────────


def test_patient_context_attached_to_generated_doc() -> None:
    """generate_documents() must return a PatientContext instance on GeneratedDocuments."""
    from models.schemas import PatientContext

    doc = generate_documents(SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"])
    assert isinstance(doc.patient_context, PatientContext)


def test_patient_context_name_matches_pool() -> None:
    """PatientContext.patient_name must match the pool entry keyed by anchor_id."""
    for anchor_id, seed in SEEDS.items():
        doc = generate_documents(seed, PROFILES[anchor_id])
        expected = get_identity(anchor_id).patient_name
        assert doc.patient_context.patient_name == expected


# ── SYNTHETIC MARKER ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_marker_in_denial_letter(anchor_id: str) -> None:
    """Denial letter text must contain SYNTHETIC_MARKER."""
    doc = generate_documents(SEEDS[anchor_id], PROFILES[anchor_id])
    assert SYNTHETIC_MARKER in doc.denial_letter_text


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_marker_in_all_clinical_snippets(anchor_id: str) -> None:
    """Every clinical snippet must contain SYNTHETIC_MARKER."""
    doc = generate_documents(SEEDS[anchor_id], PROFILES[anchor_id])
    assert doc.clinical_snippets, f"No clinical snippets generated for {anchor_id}"
    for i, snippet in enumerate(doc.clinical_snippets):
        assert SYNTHETIC_MARKER in snippet, (
            f"Marker missing in snippet[{i}] for {anchor_id}"
        )


@pytest.mark.parametrize(
    "anchor_id",
    ["ozempic_cigna", "esomeprazole_uhc_pediatric", "livdelzi_cigna_hepatology"],
)
def test_marker_in_rx_snippet(anchor_id: str) -> None:
    """Rx snippet must contain SYNTHETIC_MARKER."""
    doc = generate_documents(SEEDS[anchor_id], PROFILES[anchor_id])
    assert SYNTHETIC_MARKER in doc.rx_snippet


# ── GeneratedDocuments structure ──────────────────────────────────────────────


def test_generated_documents_has_expected_attributes() -> None:
    """GeneratedDocuments must expose denial_letter_text, clinical_snippets, rx_snippet, patient_context."""
    doc = generate_documents(SEEDS["ozempic_cigna"], PROFILES["ozempic_cigna"])
    assert isinstance(doc, GeneratedDocuments)
    assert isinstance(doc.denial_letter_text, str)
    assert isinstance(doc.clinical_snippets, list)
    assert isinstance(doc.rx_snippet, str)
    assert doc.denial_letter_text  # non-empty
    assert doc.clinical_snippets   # non-empty list
    assert doc.rx_snippet          # non-empty


def test_clinical_snippets_count_equals_criteria_count() -> None:
    """There must be exactly one clinical snippet per criterion in the profile."""
    for anchor_id in SEEDS:
        profile = PROFILES[anchor_id]
        doc = generate_documents(SEEDS[anchor_id], profile)
        assert len(doc.clinical_snippets) == len(profile.criteria), (
            f"Expected {len(profile.criteria)} snippets for {anchor_id}, "
            f"got {len(doc.clinical_snippets)}"
        )
