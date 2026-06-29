"""Synthetic-document marker constants and assertion helpers.

Every file produced by the golden-set generator must carry SYNTHETIC_MARKER
so that the Phase 0.E compliance scan can verify the corpus contains no real PHI.
"""

from __future__ import annotations

SYNTHETIC_MARKER = "SYNTHETIC — NO PHI"
# Banner is constructed so SYNTHETIC_MARKER is a literal substring of it.
SYNTHETIC_BANNER = f"*** {SYNTHETIC_MARKER} — FOR TESTING AND EVALUATION ONLY ***"


def assert_marker(text: str) -> None:
    """Raise ValueError if *text* does not contain the synthetic marker."""
    if SYNTHETIC_MARKER not in text:
        raise ValueError(
            f"Synthetic marker {SYNTHETIC_MARKER!r} is missing from document. "
            "Every generated document must carry this marker."
        )
