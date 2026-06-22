"""etl/denial_letter/file_detector.py — Magic-byte file type detection.

Identifies the type of an uploaded denial letter based on its raw bytes,
not its filename extension (which is user-controlled and untrustworthy).

Supported types: PDF, image (JPEG/PNG/TIFF), plain text.
Unsupported/executable types raise ValueError before any processing.
"""

from __future__ import annotations

from enum import StrEnum


class FileType(StrEnum):
    pdf = "pdf"
    image = "image"
    text = "text"


# Magic byte signatures
_MAGIC: list[tuple[bytes, FileType]] = [
    (b"%PDF", FileType.pdf),
    (b"\xff\xd8\xff", FileType.image),   # JPEG
    (b"\x89PNG\r\n\x1a\n", FileType.image),  # PNG
    (b"II*\x00", FileType.image),         # TIFF little-endian
    (b"MM\x00*", FileType.image),         # TIFF big-endian
    (b"GIF8", FileType.image),            # GIF
    (b"BM", FileType.image),              # BMP
]

# Executable/unsupported signatures — rejected before any processing
_REJECTED_MAGIC: list[bytes] = [
    b"MZ",        # Windows PE / DOS executable
    b"\x7fELF",   # ELF (Linux executable)
    b"PK\x03\x04",  # ZIP / Office OOXML (not yet supported)
]


def detect(raw_bytes: bytes) -> FileType:
    """Identify the file type of *raw_bytes* from its magic bytes.

    Args:
        raw_bytes: Raw file content. May be empty (returns ``FileType.text``).

    Returns:
        A :class:`FileType` value.

    Raises:
        ValueError: If the bytes match a known unsupported or executable format.
            The caller (pipeline) is responsible for the user-facing error message.
    """
    for magic in _REJECTED_MAGIC:
        if raw_bytes[:len(magic)] == magic:
            raise ValueError(f"unsupported file type (magic {magic!r})")

    for magic, file_type in _MAGIC:
        if raw_bytes[:len(magic)] == magic:
            return file_type

    return FileType.text
