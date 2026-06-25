"""Generate raw text dumps and policy skeleton templates for human authoring.

Design rationale: at N=3 documents that become labeled ground truth, auto-extracting
criteria with heading regexes invites silent mis-extractions (multi-column PDFs jumble
fitz text order; payer heading conventions vary). Instead:
  - dump_raw_text: automate the verbatim dump — deterministic, auditable, testable.
  - policy_skeleton: emit an empty template — a human fills criteria from the dump + source.

The criteria values in the finished .md must reconcile with Phase 0.D labels
(real policy value wins over the demo's illustrative numbers, e.g. Cigna A1c ≥6.5%).
"""

from __future__ import annotations

import hashlib

_SECTION_HEADERS: tuple[str, ...] = (
    "Indications",
    "Diagnostic Criteria",
    "Biomarker Thresholds",
    "Step Therapy",
    "Safety Exclusions",
    "Quantity Limits",
    "Renewal Criteria",
    "Notes",
)


def dump_raw_text(
    anchor_id: str,
    raw_text: str,
    source_url: str,
    retrieved_date: str,
) -> str:
    """Return an auditable raw-text dump string for human authoring.

    Format: fenced YAML frontmatter (anchor_id, source_url, retrieved_date, raw_sha256)
    followed by the verbatim extracted text. Written to golden/policies/_raw/{anchor_id}.txt.
    """
    raw_sha256 = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
    frontmatter = (
        "```yaml\n"
        f"anchor_id: {anchor_id}\n"
        f"source_url: {source_url}\n"
        f"retrieved_date: {retrieved_date}\n"
        f"raw_sha256: {raw_sha256}\n"
        "```\n"
    )
    return frontmatter + "\n" + raw_text


def policy_skeleton(
    anchor_id: str,
    source_url: str,
    retrieved_date: str,
) -> str:
    """Return an empty policy markdown template for human authoring.

    Format: fenced YAML frontmatter + H2 section headers with <!-- cite: --> placeholders.
    Written to golden/policies/{anchor_id}.md only if the file does not already exist
    (the writer in fetch.py guards against clobbering human-authored criteria).
    """
    frontmatter = (
        "```yaml\n"
        f"anchor_id: {anchor_id}\n"
        f"source_url: {source_url}\n"
        f"retrieved_date: {retrieved_date}\n"
        "markdown_sha256: ~  # fill after authoring and run: sha256sum golden/policies/{anchor_id}.md\n"
        "```\n"
    )
    sections = "\n".join(
        f"## {header}\n\n<!-- cite: source page/section -->\n"
        for header in _SECTION_HEADERS
    )
    return frontmatter + "\n" + sections + "\n"
