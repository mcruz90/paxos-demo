# ADAPTED from fighthealthinsurance/easyocr_fetch.py (Apache 2.0)
# Changes: easyocr removed from project (large PyTorch dep chain, last major
#          update 2021). get_ocr_reader() is preserved as a stub so any
#          third-party code that references it fails at call time — not at
#          import time — with a clear migration message.
#
# Migration: use pytesseract (already in dependencies) for OCR tasks.
#            See etl/denial_letter/pipeline.py for the replacement implementation.
"""Stub for the removed EasyOCR integration.

easyocr was removed from this project because:
  1. Last major release: 2021 (effectively unmaintained).
  2. Pulls in a large PyTorch dependency chain inappropriate for a PHI pipeline.
  3. pytesseract (Tesseract 5.x) covers all required OCR use cases.

This stub preserves the module's public API so forked fhi code that
references ``easyocr_fetch.get_ocr_reader`` fails at *call time* with a
clear error, rather than at import time with a confusing ImportError.
"""

from __future__ import annotations


def get_ocr_reader(*args, **kwargs):
    """Stub — EasyOCR has been removed from this project.

    Raises:
        NotImplementedError: Always. Use ``pytesseract`` instead.
    """
    raise NotImplementedError(
        "easyocr has been removed from PaxOS. "
        "Use pytesseract for OCR tasks (see etl/denial_letter/pipeline.py)."
    )
