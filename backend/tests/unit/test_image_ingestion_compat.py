"""Exercise the real image decode boundary after the Pillow major update."""

import io

import pytesseract
import pytest
from PIL import Image

from etl.denial_letter.file_detector import FileType, detect
from etl.denial_letter.pipeline import _extract_text_from_bytes


@pytest.mark.parametrize("image_format", ["PNG", "JPEG", "TIFF"])
def test_supported_image_is_decoded_before_the_ocr_boundary(monkeypatch, image_format):
    raw = io.BytesIO()
    Image.new("RGB", (2, 2), color="white").save(raw, format=image_format)
    assert detect(raw.getvalue()) == FileType.image
    observed = []

    def synthetic_ocr(image):
        observed.append((image.size, image.mode))
        return "SYNTHETIC compatibility text"

    monkeypatch.setattr(pytesseract, "image_to_string", synthetic_ocr)
    result = _extract_text_from_bytes(raw.getvalue(), FileType.image)
    assert result == "SYNTHETIC compatibility text"
    assert observed == [((2, 2), "RGB")]
