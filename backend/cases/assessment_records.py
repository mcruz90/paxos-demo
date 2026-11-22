"""Immutable outputs of an initial, case-local policy assessment."""

from dataclasses import dataclass
from typing import Literal

from models.case_evidence import CaseRecord, SourceVersion


@dataclass(frozen=True)
class Citation:
    source_version_id: str
    source_sha256: str
    category: str
    role: Literal["patient", "context"]
    start: int
    end: int
    excerpt: str

    @classmethod
    def from_line(cls, source: SourceVersion, start: int, line: str) -> "Citation":
        return cls(
            source.source_version_id,
            source.body_sha256,
            source.category,
            "patient" if source.category == "patient_record" else "context",
            start,
            start + len(line),
            line,
        )


@dataclass(frozen=True)
class Finding:
    criterion_id: str
    requirement: str
    status: Literal["met", "missing", "conflict"]
    note: str
    next_action: str | None
    evidence: tuple[Citation, ...]


@dataclass(frozen=True)
class Assessment:
    case: CaseRecord
    policy_text: str | None
    policy_sha256: str | None
    findings: tuple[Finding, ...]
    ready: bool
    pathway: str | None
    blockers: tuple[str, ...]
    next_action: str | None

    age_years: int | None = None

    @property
    def revision(self) -> int:
        return self.case.revision
