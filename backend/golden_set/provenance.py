"""Provenance records for public payer PA criteria sources.

ProvenanceManifest persists to backend/golden/policies/provenance.json.
The Phase 0.E compliance test asserts:
  - every policy .md has a record with non-empty terms and raw_sha256
  - raw_sha256 matches the archived sources/ bytes
  - markdown_sha256 matches the committed .md (set by human after authoring)
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from errors import ETLParseError


class ProvenanceRecord(BaseModel):
    anchor_id: str
    source_url: str
    retrieved_date: str         # ISO-8601 date (date only, not timestamp)
    effective_date: str | None = None
    raw_sha256: str             # hex digest of archived source bytes in sources/
    markdown_sha256: str | None = None  # hex digest of committed {anchor_id}.md; set after human authoring
    terms: str                  # MUST be non-empty; payer PDFs are copyrighted-but-public —
                                # record "factual criteria extracted with citation; not redistributed verbatim"
    format: Literal["pdf", "html"]


class ProvenanceManifest(BaseModel):
    records: list[ProvenanceRecord]

    @classmethod
    def load(cls, path: Path | str) -> ProvenanceManifest:
        try:
            raw = Path(path).read_text(encoding="utf-8")
            return cls.model_validate_json(raw)
        except Exception as exc:
            raise ETLParseError(
                f"Cannot parse provenance manifest at {path}: {exc}"
            ) from exc

    def save(self, path: Path | str) -> None:
        try:
            dest = Path(path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(self.model_dump_json(indent=2), encoding="utf-8")
        except Exception as exc:
            raise ETLParseError(
                f"Cannot save provenance manifest to {path}: {exc}"
            ) from exc

    def upsert(self, record: ProvenanceRecord) -> None:
        """Insert or replace an existing record by anchor_id."""
        self.records = [r for r in self.records if r.anchor_id != record.anchor_id]
        self.records.append(record)
