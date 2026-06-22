"""Security sanitization layer — cleans extracted document text before LLM ingestion.

Handles:
- Zero-width / invisible Unicode characters
- Bidirectional text override characters
- Known prompt-injection phrase patterns
- Null bytes
- Unicode homoglyph normalization (NFKD)
- PhantomLint-style OCR consistency check for hidden text in PDFs
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class SanitizeResult:
    """Outcome of sanitize_extracted_text()."""

    clean_text: str
    suspicious: bool = False
    reason: str = ""


@dataclass
class PhantomLintResult:
    """Outcome of ocr_consistency_check()."""

    has_hidden_content: bool = False
    confidence: float = 0.0
    details: str = ""


# ---------------------------------------------------------------------------
# Zero-width and invisible characters
# ---------------------------------------------------------------------------

_ZERO_WIDTH_CHARS = (
    "\u200b"  # ZERO WIDTH SPACE
    "\u200c"  # ZERO WIDTH NON-JOINER
    "\u200d"  # ZERO WIDTH JOINER
    "\u200e"  # LEFT-TO-RIGHT MARK
    "\u200f"  # RIGHT-TO-LEFT MARK
    "\ufeff"  # BOM / ZERO WIDTH NO-BREAK SPACE
    "\u00ad"  # SOFT HYPHEN
    "\u2060"  # WORD JOINER
)

_ZERO_WIDTH_RE = re.compile(f"[{re.escape(_ZERO_WIDTH_CHARS)}]")

# ---------------------------------------------------------------------------
# Bidirectional override characters (U+202A–U+202E, U+2066–U+2069)
# ---------------------------------------------------------------------------

_BIDI_RE = re.compile(
    r"[\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069]"
)

# ---------------------------------------------------------------------------
# Known prompt-injection patterns
# ---------------------------------------------------------------------------

_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+\w+", re.IGNORECASE),
    re.compile(r"\bsystem\s*:\s*disregard", re.IGNORECASE),
    re.compile(r"<!--\s*inject", re.IGNORECASE),
    re.compile(r"reveal\s+(the\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"as\s+DAN\s+you\s+must", re.IGNORECASE),
    re.compile(r"disregard\s+prior\s+instructions", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def sanitize_extracted_text(text: str) -> SanitizeResult:
    """Clean and inspect *text* extracted from an untrusted document.

    Returns a :class:`SanitizeResult` with the sanitized text and a flag
    indicating whether suspicious content was detected.
    """
    # 1. Null bytes
    clean = text.replace("\x00", "")

    # 2. Bidi override characters — flag before removing
    suspicious = False
    reason = ""
    if _BIDI_RE.search(clean):
        suspicious = True
        reason = "bidi override characters detected"
    clean = _BIDI_RE.sub("", clean)

    # 3. Zero-width characters
    clean = _ZERO_WIDTH_RE.sub("", clean)

    # 4. Unicode homoglyph normalization (NFKD → ASCII where possible)
    #    This converts Cyrillic/Greek lookalikes to their canonical forms.
    normalized = unicodedata.normalize("NFKD", clean)
    # Only use normalized form if it differs (avoids mangling legitimate Unicode)
    try:
        normalized.encode("ascii")
        clean = normalized
    except UnicodeEncodeError:
        # Contains legitimate non-ASCII; check for suspicious substitutions
        # by comparing ratio of non-ASCII to total chars
        non_ascii = sum(1 for c in clean if ord(c) > 127)
        if non_ascii / max(len(clean), 1) < 0.05:
            # Mostly ASCII with a few suspicious chars — flag it
            suspicious = True
            reason = reason or "possible unicode homoglyph substitution"

    # 5. Known injection phrases
    if not suspicious:
        for pattern in _INJECTION_PATTERNS:
            if pattern.search(clean):
                suspicious = True
                reason = f"injection pattern detected: {pattern.pattern[:40]}"
                break

    return SanitizeResult(clean_text=clean, suspicious=suspicious, reason=reason)


def ocr_consistency_check(pdf_path: Path) -> PhantomLintResult:
    """PhantomLint-style check: detect white (invisible) text in a PDF.

    Inspects the raw PDF content stream for white fill-color operators
    (``1 1 1 rg`` and variants) followed by text-drawing commands. This is
    more reliable across PyMuPDF versions than parsing span color integers
    from the rawdict format.

    Requires PyMuPDF (``fitz``).
    """
    try:
        import fitz  # type: ignore[import]
    except ImportError:
        return PhantomLintResult(
            has_hidden_content=False, confidence=0.0, details="fitz not available"
        )

    doc = fitz.open(str(pdf_path))
    found_hidden = False
    details = ""

    for page_num in range(len(doc)):
        page = doc[page_num]
        # Read the raw content stream for this page
        try:
            content = page.read_contents().decode("latin-1", errors="replace")
        except Exception:
            continue

        # PDF fill color operator: "1 1 1 rg" sets the non-stroking (fill) color
        # to white. Variants include integer 1 or float 1.0 per channel.
        _WHITE_FILL_RE = re.compile(
            r"1(?:\.0*)?\s+1(?:\.0*)?\s+1(?:\.0*)?\s+rg"
        )
        # PDF text show operators: Tj (single string), TJ (array), ' and "
        _TEXT_SHOW_RE = re.compile(r"\bTj\b|\bTJ\b")

        if _WHITE_FILL_RE.search(content) and _TEXT_SHOW_RE.search(content):
            # White color was set AND text was drawn — likely hidden content.
            # Additional heuristic: check if the white color appears before
            # a text-show operator in the stream (not just anywhere).
            white_match = _WHITE_FILL_RE.search(content)
            text_match = _TEXT_SHOW_RE.search(content, white_match.start())  # type: ignore[union-attr]
            if text_match:
                found_hidden = True
                details = f"white fill color + text draw operator on page {page_num + 1}"
                break

    doc.close()

    if found_hidden:
        return PhantomLintResult(has_hidden_content=True, confidence=0.9, details=details)
    return PhantomLintResult(has_hidden_content=False, confidence=0.0)
