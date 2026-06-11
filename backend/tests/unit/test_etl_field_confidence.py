"""Unit tests for fhi/field_confidence.py — confidence scoring logic."""

import pytest

from third_party.fhi.field_confidence import score_extracted_field


# The thresholds under test (must match implementation):
# score >= 0.6 → CriterionStatus.found
# score < 0.6  → CriterionStatus.needs_review
FOUND_THRESHOLD = 0.6


def test_exact_match_scores_high() -> None:
    """Field value found verbatim in source text should score above threshold."""
    score = score_extracted_field(
        field_value="Type 2 Diabetes Mellitus",
        source_text="Patient diagnosed with Type 2 Diabetes Mellitus per chart.",
    )
    assert score >= FOUND_THRESHOLD


def test_missing_field_scores_low() -> None:
    """Field value completely absent from source text should score below threshold."""
    score = score_extracted_field(
        field_value="Crohn's Disease",
        source_text="Patient diagnosed with Type 2 Diabetes Mellitus.",
    )
    assert score < FOUND_THRESHOLD


def test_partial_match_scores_between_thresholds() -> None:
    """Partial match (some tokens present) should score between 0 and 1."""
    score = score_extracted_field(
        field_value="Type 2 Diabetes",
        source_text="Diabetes history documented.",
    )
    assert 0.0 <= score <= 1.0


def test_empty_field_value_returns_zero() -> None:
    score = score_extracted_field(field_value="", source_text="Any text.")
    assert score == 0.0


def test_empty_source_text_returns_zero() -> None:
    score = score_extracted_field(field_value="Ozempic", source_text="")
    assert score == 0.0


def test_score_is_float() -> None:
    score = score_extracted_field(field_value="semaglutide", source_text="semaglutide prescribed.")
    assert isinstance(score, float)


def test_score_is_bounded_zero_to_one() -> None:
    score = score_extracted_field(field_value="Ozempic", source_text="Ozempic Ozempic Ozempic.")
    assert 0.0 <= score <= 1.0


def test_case_insensitive_match() -> None:
    """Confidence scoring should be case-insensitive."""
    score_lower = score_extracted_field(
        field_value="ozempic",
        source_text="Authorization for Ozempic denied.",
    )
    score_upper = score_extracted_field(
        field_value="OZEMPIC",
        source_text="Authorization for ozempic denied.",
    )
    assert score_lower >= FOUND_THRESHOLD
    assert score_upper >= FOUND_THRESHOLD
