"""Offline discovery port over the explicitly bound pediatric assessment corpus."""

from dataclasses import dataclass
from hashlib import sha256
from typing import Protocol

from cases.assessment_sources import SourceReader
from models.case_evidence import CaseRecord
from models.discovery import FullTextSource, MetadataSource

Source = FullTextSource | MetadataSource


class DiscoveryAdapter(Protocol):
    def search(self, case: CaseRecord, query: str) -> tuple[Source, ...]: ...


@dataclass(frozen=True)
class PediatricDiscovery:
    reader: SourceReader

    def search(self, case: CaseRecord, query: str) -> tuple[Source, ...]:
        inputs = self.reader.read(case)
        if inputs is None:
            return ()
        notes = [
            FullTextSource(
                source_id=source.origin_ref.removesuffix("-v1"),
                source_version_id=source.source_version_id,
                title=source.origin_ref,
                category="clinical_note",
                content_sha256=source.body_sha256,
                start=0,
                end=len(source.body),
                excerpt=source.body,
            )
            for source in inputs.sources
            if (source.tenant_id, source.patient_ref, source.case_id)
            == (case.tenant_id, case.patient_ref, case.case_id)
        ]
        title = "Outside records index (synthetic)"
        index = MetadataSource(
            source_id="outside-records-index",
            source_version_id="outside-records-index-v1",
            category="document_index",
            title=title,
            content_sha256=sha256(title.encode()).hexdigest(),
        )
        term = query.strip().casefold()
        sources: list[Source] = [*notes, index]
        return tuple(
            source
            for source in sources
            if term in " ".join((source.title, source.category, source.excerpt or "")).casefold()
        )
