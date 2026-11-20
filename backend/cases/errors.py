"""Typed, metadata-only evidence rejections for future HTTP/status mapping."""

from typing import Literal

EvidenceErrorCode = Literal[
    "source_scope_mismatch",
    "source_patient_mismatch",
    "context_source_has_patient",
    "source_version_mismatch",
    "stale_case_revision",
    "source_digest_mismatch",
    "invalid_excerpt_span",
    "excerpt_mismatch",
]


class EvidenceRejected(ValueError):
    def __init__(self, code: EvidenceErrorCode):
        self.code = code
        super().__init__(code)
