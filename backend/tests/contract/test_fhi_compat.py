"""Contract tests — verify forked fhi modules import and behave as expected.

These tests run in CI to catch regressions if fhi files are modified.
They do NOT call a real LLM.
"""

from __future__ import annotations

import pytest


def test_denial_base_imports() -> None:
    """denial_base.py must be importable and expose the expected interface."""
    from third_party.fhi.denial_base import DenialBase
    assert hasattr(DenialBase, "__init__")


def test_medical_code_extractor_imports() -> None:
    """medical_code_extractor.py must export the three extraction functions."""
    from third_party.fhi.medical_code_extractor import (
        extract_dme_devices,
        extract_icd10_codes,
        extract_procedure_codes,
    )
    assert callable(extract_icd10_codes)
    assert callable(extract_procedure_codes)
    assert callable(extract_dme_devices)


def test_field_confidence_imports() -> None:
    from third_party.fhi.field_confidence import score_extracted_field
    assert callable(score_extracted_field)


def test_context_utils_stub_imports() -> None:
    from third_party.fhi.context_utils import truncate_at_boundary
    assert callable(truncate_at_boundary)


def test_truncate_at_boundary_respects_limit() -> None:
    from third_party.fhi.context_utils import truncate_at_boundary
    text = "word " * 200
    result = truncate_at_boundary(text, 50)
    assert len(result) <= 50


def test_truncate_at_boundary_short_text_unchanged() -> None:
    from third_party.fhi.context_utils import truncate_at_boundary
    text = "short text"
    assert truncate_at_boundary(text, 100) == text


def test_prompt_templates_imports() -> None:
    from third_party.fhi.prompt_templates import ChatType
    assert hasattr(ChatType, "APPEAL")


def test_generate_appeal_imports_without_django() -> None:
    """generate_appeal.py must import cleanly without Django installed."""
    from third_party.fhi import generate_appeal
    assert hasattr(generate_appeal, "AppealGenerator") or hasattr(generate_appeal, "make_appeals")


def test_easyocr_fetch_exposes_factory() -> None:
    """easyocr_fetch.py must expose get_ocr_reader() factory (not a module-level singleton)."""
    from third_party.fhi.easyocr_fetch import get_ocr_reader
    assert callable(get_ocr_reader)
