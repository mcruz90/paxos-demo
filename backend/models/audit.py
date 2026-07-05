"""Audit record + introspection response types.

The ``AuditRecord`` (in-memory pre-DB — written at both pipeline boundaries,
before the terminal SSE event; S2 Slice 4) plus the read-only introspection
surfaces over the audit store + review queue (S3 Task 3).

Depends on ``models.enums`` (CaseLifecycle, CaseTier, AuditProvenance) and
``models.events`` (PaResolution). Re-exported through ``models.schemas`` —
import from there, not from here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from models.enums import AuditProvenance, CaseLifecycle, CaseTier
from models.events import PaResolution


class AuditRecord(BaseModel):
    """One entry per pipeline run — done or error, either lifecycle.

    Identifiers and hashes only, never letter/request text (PHI rule).
    Idempotent on ``idempotency_key`` = case_id + attempt (ADR-0009);
    ``correlation_id`` coincides with it pre-DB, so a single ID traces logs,
    the terminal event, and this record.
    """

    correlation_id: str
    idempotency_key: str
    lifecycle: CaseLifecycle
    case_ref: str = ""
    scenario_id: str
    drug: str
    plan: str
    denial_reason: str = ""  # appeal lifecycle only
    timestamp: str
    duration_ms: int
    outcome: Literal["done", "error"]
    # "" for the no-LLM initial-PA path.
    model_name: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    # sha256 prefix of the outbound artifact: DoneEvent.ref (appeal letter)
    # or the PAS submission_ref (initial PA). "" on error runs.
    artifact_ref: str = ""
    gatekeeper_passed: bool = False
    retry_count: int = 0
    structural_eval_scores: dict[str, float] = Field(default_factory=dict)
    # Which retrieval path produced the PA criteria (hard-5).
    pa_resolution: PaResolution = ""
    # Deterministic HITL review tier the artifact was routed to (S3 Slice 3).
    # None on an error run: the exhausted path produced no letter, so there is
    # nothing to route to a review surface — tier is a property of an artifact.
    tier: CaseTier | None = None
    # AI-accountability: what the artifact was when it left the system.
    provenance: AuditProvenance


# ---------------------------------------------------------------------------
# Introspection response types (S3 Task 3) — read-only, Bearer-gated tooling
# surfaces over the audit store + review queue. Backend-tooling only: NOT
# mirrored in src/types.ts (frontend HITL integration is a later sprint), so
# they are deliberately outside the schema-parity guard.
# ---------------------------------------------------------------------------


class PendingReviewItem(BaseModel):
    """One parked exception-tier run awaiting human review (S3 Task 3).

    Metadata only — never the letter/request text (CLAUDE.md PHI rule). A
    reviewer surfaces the queue with this; the draft body is a deferred Slice
    4c surface. ``parked_at`` is the timestamp of the exception ``done`` audit
    record (when the run parked at ``hold``). ``tier`` is always ``exception``
    today (only that tier parks), carried explicitly so the shape survives if
    another tier ever gains a review checkpoint.
    """

    correlation_id: str
    scenario_id: str
    drug: str
    plan: str
    tier: CaseTier
    parked_at: str


class PendingReviewsResponse(BaseModel):
    """Response body for GET /api/reviews/pending (S3 Task 3).

    Wrapped (not a bare array) so the payload can gain top-level metadata
    without a breaking change.
    """

    reviews: list[PendingReviewItem]


class AuditRecordsResponse(BaseModel):
    """Response body for GET /api/audit/records (S3 Task 3).

    Returns :class:`AuditRecord` entries as-is (already identifiers-and-hashes
    only by design). Wrapped for the same forward-compat reason as
    :class:`PendingReviewsResponse`.
    """

    records: list[AuditRecord]
