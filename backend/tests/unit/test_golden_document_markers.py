"""Structure and synthetic markers of generated documents."""

import pytest

from golden_set.documents import GeneratedDocuments, generate_documents
from golden_set.markers import SYNTHETIC_MARKER
from golden_set.seeds import PROFILES, SEEDS


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
        assert SYNTHETIC_MARKER in snippet, f"Marker missing in snippet[{i}] for {anchor_id}"


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
    assert doc.clinical_snippets  # non-empty list
    assert doc.rx_snippet  # non-empty


def test_clinical_snippets_count_equals_criteria_count() -> None:
    """There must be exactly one clinical snippet per criterion in the profile."""
    for anchor_id in SEEDS:
        profile = PROFILES[anchor_id]
        doc = generate_documents(SEEDS[anchor_id], profile)
        assert len(doc.clinical_snippets) == len(profile.criteria), (
            f"Expected {len(profile.criteria)} snippets for {anchor_id}, "
            f"got {len(doc.clinical_snippets)}"
        )
