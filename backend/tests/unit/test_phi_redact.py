"""Unit tests for security.redact.redact_phi() — PHI scrubbing before Langfuse logging."""

import pytest

from security.redact import redact_phi


# --- Positive cases: PHI should be removed ---


def test_mrn_pattern_redacted() -> None:
    """MRN format PH-XXXX must be scrubbed."""
    text = "Patient PH-1234 was denied coverage."
    result = redact_phi(text)
    assert "PH-1234" not in result
    assert "[REDACTED]" in result or "***" in result


def test_date_of_birth_redacted() -> None:
    """MM/DD/YYYY dates must be scrubbed."""
    text = "Member DOB: 01/15/1980 was denied."
    result = redact_phi(text)
    assert "01/15/1980" not in result


def test_full_name_redacted() -> None:
    """Two-word proper name (Title Case) must be scrubbed."""
    text = "Patient John Smith was denied Ozempic."
    result = redact_phi(text)
    assert "John Smith" not in result


def test_multiple_phi_fields_all_redacted() -> None:
    text = "Patient Jane Doe (PH-9999, DOB: 03/22/1975) denied Ozempic."
    result = redact_phi(text)
    assert "Jane Doe" not in result
    assert "PH-9999" not in result
    assert "03/22/1975" not in result


def test_ssn_pattern_redacted() -> None:
    """SSN format XXX-XX-XXXX must be scrubbed."""
    text = "SSN 123-45-6789 on file."
    result = redact_phi(text)
    assert "123-45-6789" not in result


# --- Negative cases: clinical text must not be altered ---


def test_drug_name_not_redacted() -> None:
    """Drug names like 'Ozempic' must survive redaction."""
    text = "Authorization for Ozempic denied. Formulary alternatives available."
    result = redact_phi(text)
    assert "Ozempic" in result
    assert "Formulary" in result


def test_diagnosis_code_not_redacted() -> None:
    """ICD-10 codes must survive redaction."""
    text = "Diagnosis E11.9 (Type 2 Diabetes) documented."
    result = redact_phi(text)
    assert "E11.9" in result


def test_denial_reason_not_redacted() -> None:
    text = "Denial reason: formulary alternatives available."
    result = redact_phi(text)
    assert "formulary alternatives available" in result


def test_empty_string_returns_empty_string() -> None:
    assert redact_phi("") == ""


def test_no_phi_text_returned_unchanged() -> None:
    text = "Authorization denied. Drug not on formulary."
    result = redact_phi(text)
    assert result == text
