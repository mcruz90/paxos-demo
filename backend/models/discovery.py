"""Wire contracts for fixed discovery snapshots and case-local attachment commands."""

from typing import Annotated, Literal

from pydantic import AwareDatetime, Field

from models.case_evidence import Digest, ExcerptSpan, FrozenRecord, RecordId
from models.case_store import PersistentCaseId


class DiscoveryWrite(FrozenRecord):
    expected_revision: int = Field(ge=1, le=2**63 - 1)


class DiscoverySearch(DiscoveryWrite):
    query: str = Field(max_length=256)


class AttachmentRequest(DiscoveryWrite):
    request_id: RecordId


class AttachResult(AttachmentRequest):
    result_id: PersistentCaseId


class SourceIdentity(FrozenRecord):
    source_id: RecordId
    source_version_id: RecordId
    category: Literal["clinical_note", "document_index"]
    title: str = Field(min_length=1, max_length=200)
    content_sha256: Digest


class FullTextSource(SourceIdentity, ExcerptSpan):
    availability: Literal["full_text"] = "full_text"


class MetadataSource(SourceIdentity):
    availability: Literal["metadata_only"] = "metadata_only"
    start: None = None
    end: None = None
    excerpt: None = None


class FullTextResult(FullTextSource):
    result_id: PersistentCaseId


class MetadataResult(MetadataSource):
    result_id: PersistentCaseId


DiscoveryItem = Annotated[FullTextResult | MetadataResult, Field(discriminator="availability")]


class DiscoveryResults(FrozenRecord):
    query_id: PersistentCaseId
    query: str = Field(max_length=256)
    revision: int
    items: tuple[DiscoveryItem, ...]


class CaseAttachment(FrozenRecord):
    attachment_id: PersistentCaseId
    item: DiscoveryItem
    actor_id: RecordId
    attached_at: AwareDatetime
