"""Unit tests for ICD-10, CPT, and HCPCS regex extraction (fhi/medical_code_extractor.py)."""

import pytest

from third_party.fhi.medical_code_extractor import (
    extract_dme_devices,
    extract_icd10_codes,
    extract_procedure_codes,
)


# ---------------------------------------------------------------------------
# ICD-10 extraction
# ---------------------------------------------------------------------------


def test_extracts_standard_icd10_code() -> None:
    text = "Diagnosis: E11.9 - Type 2 diabetes mellitus without complications."
    codes = extract_icd10_codes(text)
    assert "E11.9" in codes


def test_extracts_multiple_icd10_codes() -> None:
    text = "Patient has E11.9 and Z79.84 (long-term insulin use)."
    codes = extract_icd10_codes(text)
    assert "E11.9" in codes
    assert "Z79.84" in codes


def test_icd10_code_with_dash_prefix_extracted() -> None:
    text = "ICD-10: E66.01 - Morbid (severe) obesity due to excess calories"
    codes = extract_icd10_codes(text)
    assert "E66.01" in codes


def test_no_false_positive_on_plain_numbers() -> None:
    """Strings like '11.9' without a letter prefix must not match."""
    text = "BMI was 11.9 at the visit."
    codes = extract_icd10_codes(text)
    assert "11.9" not in codes


def test_empty_string_returns_empty_list() -> None:
    assert extract_icd10_codes("") == []


# ---------------------------------------------------------------------------
# CPT / HCPCS extraction
# ---------------------------------------------------------------------------


def test_extracts_cpt_code() -> None:
    text = "Procedure: CPT 99213 - Office or outpatient visit."
    codes = extract_procedure_codes(text)
    assert "99213" in codes


def test_extracts_hcpcs_level_ii_code() -> None:
    text = "HCPCS J0131 - Acetaminophen injection, 10 mg."
    codes = extract_procedure_codes(text)
    assert "J0131" in codes


def test_extracts_multiple_procedure_codes() -> None:
    text = "Procedures 99213, 99214, and J3490 were billed."
    codes = extract_procedure_codes(text)
    assert "99213" in codes
    assert "99214" in codes
    assert "J3490" in codes


# ---------------------------------------------------------------------------
# DME device extraction
# ---------------------------------------------------------------------------


def test_detects_cgm_device() -> None:
    text = "Patient uses a Dexcom G7 continuous glucose monitor."
    devices = extract_dme_devices(text)
    assert len(devices) > 0


def test_no_dme_in_plain_drug_denial() -> None:
    text = "Authorization for Ozempic denied. Formulary alternatives available."
    devices = extract_dme_devices(text)
    # Should return empty — drug-only denials don't reference DME
    assert devices == [] or all("cgm" not in d.lower() and "pump" not in d.lower() for d in devices)
