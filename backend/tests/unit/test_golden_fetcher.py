"""Unit tests for golden_set ETL pipeline — fetcher, provenance, markdown generation.

All tests are network-free (httpx.get mocked) and LLM-free.
Run from backend/: uv run pytest tests/unit/test_golden_fetcher.py -v
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import fitz
import pytest

from golden_set.policy_fetcher import (
    extract_html_text,
    extract_pdf_text,
    fetch_raw,
)
from golden_set.policy_markdown import dump_raw_text, policy_skeleton
from golden_set.provenance import ProvenanceManifest, ProvenanceRecord

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_minimal_pdf() -> bytes:
    """Return raw bytes of a minimal single-page PDF via fitz."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 100), "Coverage Criteria: Type 2 Diabetes required.", fontsize=12)
    buf = doc.tobytes()
    doc.close()
    return buf


def _cigna_mock_response(content: bytes = b"%PDF-fake") -> MagicMock:
    """Return a mock httpx.Response for static.cigna.com."""
    resp = MagicMock()
    resp.headers = {"content-length": str(len(content))}
    resp.content = content
    resp.raise_for_status = MagicMock()
    return resp


# ---------------------------------------------------------------------------
# Domain allowlist
# ---------------------------------------------------------------------------


def test_domain_allowlist_rejects_unknown_host() -> None:
    """fetch_raw must raise ValueError for any host not in ALLOWED_DOMAINS."""
    with pytest.raises(ValueError, match="not in the allowed list"):
        fetch_raw("https://evil.example.com/x.pdf")


@patch("golden_set.policy_fetcher.httpx.get")
def test_domain_allowlist_accepts_cigna(mock_get: MagicMock) -> None:
    """fetch_raw must succeed for an allowlisted Cigna domain."""
    content = b"%PDF-1.4 minimal"
    mock_get.return_value = _cigna_mock_response(content)

    raw, sha256 = fetch_raw("https://static.cigna.com/test.pdf")

    assert raw == content
    assert len(sha256) == 64  # hex sha256


# ---------------------------------------------------------------------------
# Size guard
# ---------------------------------------------------------------------------


@patch("golden_set.policy_fetcher.httpx.get")
def test_fetch_raw_rejects_oversize(mock_get: MagicMock) -> None:
    """Reject via Content-Length header check before any fitz/parse call."""
    resp = MagicMock()
    resp.headers = {"content-length": str(5 * 1024 * 1024 + 1)}
    resp.raise_for_status = MagicMock()
    mock_get.return_value = resp

    with pytest.raises(ValueError, match="Content-Length"):
        fetch_raw("https://static.cigna.com/large.pdf")


# ---------------------------------------------------------------------------
# SHA-256 stability
# ---------------------------------------------------------------------------


def test_sha256_stable() -> None:
    """Same bytes must produce the same sha256 hex across two calls."""
    import hashlib

    data = b"test bytes for sha256"
    h1 = hashlib.sha256(data).hexdigest()
    h2 = hashlib.sha256(data).hexdigest()
    assert h1 == h2
    assert len(h1) == 64


# ---------------------------------------------------------------------------
# PDF extraction
# ---------------------------------------------------------------------------


def test_extract_pdf_text_nonempty() -> None:
    """extract_pdf_text must return non-empty string from a valid fitz PDF."""
    raw = _make_minimal_pdf()
    text = extract_pdf_text(raw)
    assert len(text.strip()) > 0
    assert "Criteria" in text


# ---------------------------------------------------------------------------
# HTML extraction
# ---------------------------------------------------------------------------


def test_extract_html_text_strips_tags() -> None:
    """extract_html_text must remove all HTML tags and return visible text."""
    html_bytes = b"<h2>Criteria</h2><p>Step therapy required.</p>"
    text = extract_html_text(html_bytes)
    assert "<" not in text
    assert ">" not in text
    assert "Criteria" in text
    assert "Step therapy required" in text


# ---------------------------------------------------------------------------
# Provenance round-trip
# ---------------------------------------------------------------------------


def test_provenance_roundtrip(tmp_path: Path) -> None:
    """ProvenanceManifest must serialize to JSON and deserialize identically."""
    record = ProvenanceRecord(
        anchor_id="ozempic_cigna",
        source_url="https://static.cigna.com/test.pdf",
        retrieved_date="2026-06-25",
        raw_sha256="abc123def456",
        terms="factual criteria extracted with citation; not redistributed verbatim",
        format="pdf",
    )
    manifest = ProvenanceManifest(records=[record])
    path = tmp_path / "provenance.json"
    manifest.save(path)

    loaded = ProvenanceManifest.load(path)
    assert len(loaded.records) == 1
    assert loaded.records[0].anchor_id == "ozempic_cigna"
    assert loaded.records[0].raw_sha256 == "abc123def456"
    assert loaded.records[0].format == "pdf"


# ---------------------------------------------------------------------------
# ETLParseError
# ---------------------------------------------------------------------------


def test_etl_parse_error_raises(tmp_path: Path) -> None:
    """ETLParseError must be importable from errors and raised on malformed manifest."""
    from errors import ETLParseError

    bad_manifest = tmp_path / "bad.json"
    bad_manifest.write_text("{ not valid json at all }", encoding="utf-8")

    with pytest.raises(ETLParseError):
        ProvenanceManifest.load(bad_manifest)


# ---------------------------------------------------------------------------
# dump_raw_text
# ---------------------------------------------------------------------------


def test_dump_raw_text_has_frontmatter_and_body() -> None:
    """dump_raw_text must emit a fenced YAML block containing anchor_id, then verbatim text."""
    output = dump_raw_text(
        anchor_id="ozempic_cigna",
        raw_text="Coverage Criteria\nType 2 Diabetes required.",
        source_url="https://static.cigna.com/test.pdf",
        retrieved_date="2026-06-25",
    )
    assert "```yaml" in output
    assert "anchor_id: ozempic_cigna" in output
    assert "raw_sha256:" in output
    # verbatim body follows
    assert "Coverage Criteria" in output
    assert "Type 2 Diabetes required." in output


# ---------------------------------------------------------------------------
# policy_skeleton
# ---------------------------------------------------------------------------


def test_policy_skeleton_has_empty_sections() -> None:
    """policy_skeleton must emit H2 headers with citation placeholders and no auto-criteria."""
    output = policy_skeleton(
        anchor_id="ozempic_cigna",
        source_url="https://static.cigna.com/test.pdf",
        retrieved_date="2026-06-25",
    )
    assert "```yaml" in output
    assert "anchor_id: ozempic_cigna" in output
    # All required section headers present
    for section in ("Indications", "Diagnostic Criteria", "Biomarker Thresholds",
                    "Step Therapy", "Safety Exclusions", "Quantity Limits",
                    "Renewal Criteria", "Notes"):
        assert f"## {section}" in output
    # Citation placeholders present
    assert "<!-- cite:" in output
    # No auto-filled criteria values
    assert "HbA1c" not in output
    assert "metformin" not in output.lower()


# ---------------------------------------------------------------------------
# No-clobber writer
# ---------------------------------------------------------------------------


def test_writer_does_not_clobber_existing_md(tmp_path: Path) -> None:
    """write_if_new must not overwrite an existing human-authored .md file."""
    from golden_set.fetch import write_if_new

    existing = tmp_path / "ozempic_cigna.md"
    original_content = "# Human authored content\n\nHbA1c >= 6.5%\n"
    existing.write_text(original_content, encoding="utf-8")

    wrote = write_if_new(existing, "# New skeleton — should not appear\n")

    assert wrote is False
    assert existing.read_text(encoding="utf-8") == original_content
