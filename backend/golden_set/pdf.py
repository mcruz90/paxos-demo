"""Render synthetic text documents as text-layer PDFs using PyMuPDF (fitz).

render_denial_letter_pdf() mirrors the existing pattern in
tests/unit/test_etl_denial_pipeline.py and produces PDFs that round-trip
cleanly through process_denial_letter() via fitz.get_text().

Optional: rasterize_page_to_png() converts a single page to a PNG bytes for
the pytesseract OCR path.  Not on the default test path — skipped when
Tesseract is not installed.
"""

from __future__ import annotations

import textwrap

_PAGE_WIDTH = 595   # A4 points
_PAGE_HEIGHT = 842
_MARGIN_X = 50
_MARGIN_Y = 50
_LINE_HEIGHT = 14
_FONT_SIZE = 10
# Helvetica at fontsize 10 is ~6 pts/char; usable width ≈ (595-100)/6 ≈ 82 chars.
# 80 is conservative to avoid fitz clipping text at the right margin.
_CHARS_PER_LINE = 80


def render_denial_letter_pdf(text: str) -> bytes:
    """Render *text* as a multi-page text-layer PDF.

    Uses PyMuPDF (fitz) — already a project dependency.
    Returns raw PDF bytes starting with b"%PDF".

    Long logical lines are word-wrapped at _CHARS_PER_LINE characters so that
    fitz does not clip them at the page boundary.  fitz.get_text() extracts each
    inserted text object as a separate line, so a round-trip caller that needs
    to search for a multi-word phrase spanning a wrap point should normalize
    whitespace before substring comparison.
    """
    import fitz  # type: ignore[import]

    doc = fitz.open()
    page = doc.new_page(width=_PAGE_WIDTH, height=_PAGE_HEIGHT)
    y = _MARGIN_Y

    for line in text.splitlines():
        # Word-wrap long lines to avoid fitz right-margin clipping.
        # Empty lines produce a single empty string to preserve spacing.
        wrapped = textwrap.wrap(line, width=_CHARS_PER_LINE) if line.strip() else [""]
        for segment in wrapped:
            if y + _LINE_HEIGHT > _PAGE_HEIGHT - _MARGIN_Y:
                page = doc.new_page(width=_PAGE_WIDTH, height=_PAGE_HEIGHT)
                y = _MARGIN_Y
            page.insert_text((_MARGIN_X, y), segment, fontsize=_FONT_SIZE)
            y += _LINE_HEIGHT

    buf = doc.tobytes()
    doc.close()
    return buf


def rasterize_page_to_png(pdf_bytes: bytes, page_index: int = 0) -> bytes:
    """Rasterize one PDF page to PNG bytes at 150 DPI for OCR path testing.

    Returns raw PNG bytes.  Raises ImportError if pytesseract / Pillow are
    unavailable (off the default test path).
    """
    import fitz  # type: ignore[import]

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[page_index]
    mat = fitz.Matrix(150 / 72, 150 / 72)  # 150 DPI
    pix = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    doc.close()
    return png_bytes
