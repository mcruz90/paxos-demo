"""CLI bootstrap: fetch public payer PA criteria for the 3 golden-set anchors.

This is a run-once bootstrap, NOT a reproducible pipeline. Payer URLs rotate
(e.g. the date baked into UHC-Complete-1-1-26.pdf). CI never fetches — the
committed artifacts in golden/policies/ are the source of truth.

Run from backend/:
    python -m golden_set.fetch [--anchor ozempic_cigna|esomeprazole_uhc_pediatric|ocaliva_aetna_hepatology|all]
    python -m golden_set.fetch --dry-run

After the fetch:
  1. Human authors each golden/policies/{anchor_id}.md from its _raw/ dump + source.
  2. Recompute markdown_sha256 and update provenance.json:
       python -c "
       import hashlib; from pathlib import Path
       print(hashlib.sha256(Path('golden/policies/ozempic_cigna.md').read_bytes()).hexdigest())
       "
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

from golden_set.policy_fetcher import extract_html_text, extract_pdf_text, fetch_raw
from golden_set.policy_markdown import dump_raw_text, policy_skeleton
from golden_set.provenance import ProvenanceManifest, ProvenanceRecord

# ---------------------------------------------------------------------------
# Anchor source registry — update URLs when payers rotate their policy docs
# ---------------------------------------------------------------------------

ANCHOR_SOURCES: dict[str, dict[str, str]] = {
    "ozempic_cigna": {
        "url": (
            "https://static.cigna.com/assets/chcp/pdf/coveragePolicies/cnf/"
            "cnf_360_coveragepositioncriteria_glucagon-like_peptide-1_agonists_pa.pdf"
        ),
        "format": "pdf",
        "terms": "factual criteria extracted with citation; not redistributed verbatim",
    },
    "esomeprazole_uhc_pediatric": {
        # NOTE: verify this PDF carries clinical criteria, not just a PA flag.
        # If only a flag, locate the matching OptumRx coverage-determination doc.
        "url": (
            "https://www.uhcprovider.com/content/dam/provider/docs/public/"
            "prior-auth/pa-requirements/uhc-complete/UHC-Complete-1-1-26.pdf"
        ),
        "format": "pdf",
        "terms": "factual criteria extracted with citation; not redistributed verbatim",
    },
    "ocaliva_aetna_hepatology": {
        "url": "https://www.aetna.com/products/rxnonmedicare/data/2025/Ocaliva_2029-A_SGM_P2024.html",
        "format": "html",
        "terms": "factual criteria extracted with citation; not redistributed verbatim",
    },
}


def write_if_new(path: Path, content: str) -> bool:
    """Write content to path only if it does not already exist.

    Returns True if written, False if skipped (preserves human-authored criteria).
    """
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return True


def run_anchor(anchor_id: str, out_dir: Path, dry_run: bool = False) -> None:
    config = ANCHOR_SOURCES[anchor_id]
    url: str = config["url"]
    fmt: str = config["format"]
    terms: str = config["terms"]
    today = date.today().isoformat()

    print(f"[{anchor_id}] fetching {url} ...")
    raw_bytes, raw_sha256 = fetch_raw(url)

    if fmt == "pdf":
        text = extract_pdf_text(raw_bytes)
    else:
        text = extract_html_text(raw_bytes)

    print(f"[{anchor_id}] extracted {len(text):,} chars, raw_sha256={raw_sha256[:8]}…")

    if dry_run:
        print(f"[{anchor_id}] --dry-run: skipping all writes")
        return

    # Archive raw source bytes (makes raw_sha256 re-verifiable)
    ext = "pdf" if fmt == "pdf" else "html"
    sources_dir = out_dir / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    (sources_dir / f"{anchor_id}.{ext}").write_bytes(raw_bytes)

    # Write raw text dump (always overwrite — derived, not hand-authored)
    raw_dir = out_dir / "_raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    dump = dump_raw_text(anchor_id, text, url, today)
    (raw_dir / f"{anchor_id}.txt").write_text(dump, encoding="utf-8")

    # Write skeleton .md only if it does not already exist
    skeleton = policy_skeleton(anchor_id, url, today)
    wrote = write_if_new(out_dir / f"{anchor_id}.md", skeleton)
    if wrote:
        print(
            f"[{anchor_id}] wrote skeleton {anchor_id}.md — "
            f"author criteria from _raw/{anchor_id}.txt"
        )
    else:
        print(
            f"[{anchor_id}] {anchor_id}.md already exists — "
            "skipped (human-authored criteria preserved)"
        )

    # Update provenance manifest
    manifest_path = out_dir / "provenance.json"
    manifest = (
        ProvenanceManifest.load(manifest_path)
        if manifest_path.exists()
        else ProvenanceManifest(records=[])
    )
    manifest.upsert(
        ProvenanceRecord(
            anchor_id=anchor_id,
            source_url=url,
            retrieved_date=today,
            raw_sha256=raw_sha256,
            terms=terms,
            format=fmt,  # type: ignore[arg-type]
        )
    )
    manifest.save(manifest_path)
    print(f"[{anchor_id}] provenance updated → {manifest_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch public payer PA criteria for golden-set anchors.",
        epilog="Run from backend/. This is a run-once bootstrap — never run in CI.",
    )
    parser.add_argument(
        "--anchor",
        choices=[*ANCHOR_SOURCES.keys(), "all"],
        default="all",
        help="Which anchor to fetch (default: all)",
    )
    parser.add_argument(
        "--out-dir",
        default="golden/policies",
        help="Output directory (default: golden/policies, relative to backend/)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and extract but do not write any files",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    anchors = list(ANCHOR_SOURCES.keys()) if args.anchor == "all" else [args.anchor]

    for anchor_id in anchors:
        run_anchor(anchor_id, out_dir, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
