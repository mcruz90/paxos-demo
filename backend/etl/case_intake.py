"""Prepare case documents at the deterministic text intake boundary."""

import re
from dataclasses import dataclass, field, replace
from hashlib import sha256

from etl.denial_letter.document_type import classify
from etl.denial_letter.fields import DenialFields, extract_fields
from etl.denial_letter.file_detector import FileType, detect
from security.case_tokens.combine import combine
from security.case_tokens.deidentify import MAX_INPUT
from security.case_tokens.fields import cued
from security.case_tokens.known_identity import KnownIdentity
from security.case_tokens.npi import OfflineRegistry
from security.case_tokens.tokens import TOKEN_LIKE, literals, rehydrate
from security.sanitize import sanitize_extracted_text

MAX_DOCUMENT_CHARS = MAX_INPUT
MAX_DOCUMENT_BYTES = 4 * MAX_DOCUMENT_CHARS
_UNSUPPORTED_CONTROL = re.compile(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


class IntakeHeld(ValueError):
    """Intake or restoration stopped with a reason that can be logged."""


@dataclass(frozen=True)
class CanonicalDocument:
    version_id: str
    kind: str
    body: str = field(repr=False)
    body_sha256: str


@dataclass(frozen=True)
class IntakeResult:
    document: CanonicalDocument
    tokenized_text: str = field(repr=False)
    denial: DenialFields | None = field(repr=False)


def _canonical_text(raw: bytes) -> str:
    if len(raw) > MAX_DOCUMENT_BYTES:
        raise IntakeHeld("document_too_large")
    try:
        if detect(raw) != FileType.text:
            raise ValueError
        text = raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    except ValueError:
        raise IntakeHeld("unsupported_document") from None
    if len(text) > MAX_DOCUMENT_CHARS:
        raise IntakeHeld("document_too_large")
    if _UNSUPPORTED_CONTROL.search(text):
        raise IntakeHeld("unsupported_document")
    sanitized = sanitize_extracted_text(text)
    if sanitized.suspicious:
        raise IntakeHeld("unsafe_document")
    if len(sanitized.clean_text) > MAX_DOCUMENT_CHARS:
        raise IntakeHeld("document_too_large")
    if not sanitized.clean_text.strip():
        raise IntakeHeld("empty_document")
    return sanitized.clean_text


@dataclass(frozen=True)
class CaseIntake:
    """One case's trusted identity and immutable token table snapshot."""

    identity: KnownIdentity = field(repr=False)
    _entries: tuple[tuple[str, str], ...] = field(default=(), repr=False)
    _literals: frozenset[str] = field(default_factory=frozenset, repr=False)

    def ingest(self, version_id: str, raw: bytes) -> tuple[IntakeResult, "CaseIntake"]:
        """Return a document and the next table only after every intake check passes."""
        body = _canonical_text(raw)
        prior = dict(self._entries)
        document_literals = literals((body,))
        if document_literals.intersection(prior):
            raise IntakeHeld("token_collision")

        # Intake uses the deterministic detector with an empty offline prescriber registry.
        reserved = self._literals | document_literals
        tokenized = combine(
            body,
            cued(body),
            [],
            OfflineRegistry(()),
            known=self.identity,
            mapping=prior,
            reserved=reserved,
        )
        if tokenized.residual is None or tokenized.residual.held:
            raise IntakeHeld("residual_identifier")

        kind = classify(body)
        denial = extract_fields(tokenized.text) if kind == "denial" else None
        document = CanonicalDocument(
            version_id, kind, body, sha256(body.encode("utf-8")).hexdigest()
        )
        snapshot = replace(self, _entries=tuple(tokenized.mapping.items()), _literals=reserved)
        return IntakeResult(document, tokenized.text, denial), snapshot

    def restore(self, text: str) -> str:
        """Restore only mapped tokens as a single operation on the trusted data plane."""
        mapping = dict(self._entries)
        remaining = TOKEN_LIKE.sub("", text)
        if "{{" in remaining or "}}" in remaining:
            raise IntakeHeld("unmapped_token")
        restored = rehydrate(text, mapping)
        if restored.unresolved:
            raise IntakeHeld("unmapped_token")
        return restored.text
