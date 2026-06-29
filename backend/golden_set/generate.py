"""CLI: generate all synthetic golden-set artifacts for the 3 anchors.

Usage (from backend/):
    uv run python -m golden_set.generate
    uv run python -m golden_set.generate --anchor ozempic_cigna
    uv run python -m golden_set.generate --out-dir /tmp/golden-out

Output layout per anchor:
    golden/synthetic/<anchor_id>/
        denial_letter.txt
        denial_letter.pdf
        clinical_<i>_<key>.txt
        rx_snippet.txt

This module is never imported by api/ or agents/. It is build-time tooling only.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from golden_set.documents import generate_documents
from golden_set.markers import assert_marker
from golden_set.pdf import render_denial_letter_pdf
from golden_set.seeds import PROFILES, SEEDS

_DEFAULT_OUT_ROOT = Path(__file__).parent.parent / "golden" / "synthetic"


def _generate_one(anchor_id: str, out_root: Path) -> None:
    seed = SEEDS[anchor_id]
    profile = PROFILES[anchor_id]
    docs = generate_documents(seed, profile)

    out_dir = out_root / anchor_id
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- denial letter (text + PDF) ---
    assert_marker(docs.denial_letter_text)
    (out_dir / "denial_letter.txt").write_text(docs.denial_letter_text, encoding="utf-8")
    pdf_bytes = render_denial_letter_pdf(docs.denial_letter_text)
    (out_dir / "denial_letter.pdf").write_bytes(pdf_bytes)

    # --- clinical snippets ---
    for i, (crit, snippet) in enumerate(zip(profile.criteria, docs.clinical_snippets)):
        assert_marker(snippet)
        fname = f"clinical_{i:02d}_{crit.key}.txt"
        (out_dir / fname).write_text(snippet, encoding="utf-8")

    # --- rx snippet ---
    assert_marker(docs.rx_snippet)
    (out_dir / "rx_snippet.txt").write_text(docs.rx_snippet, encoding="utf-8")

    print(f"  [{anchor_id}] → {out_dir} ({len(profile.criteria)} criteria snippets)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate synthetic golden-set documents for the 3 anchors."
    )
    parser.add_argument(
        "--anchor",
        choices=list(SEEDS.keys()),
        default=None,
        help="Generate only this anchor (default: all three).",
    )
    parser.add_argument(
        "--out-dir",
        default=str(_DEFAULT_OUT_ROOT),
        help=f"Root output directory (default: {_DEFAULT_OUT_ROOT}).",
    )
    args = parser.parse_args(argv)

    out_root = Path(args.out_dir)
    anchors = [args.anchor] if args.anchor else list(SEEDS.keys())

    print(f"Generating synthetic golden-set artifacts → {out_root}")
    for anchor_id in anchors:
        _generate_one(anchor_id, out_root)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
