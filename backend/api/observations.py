"""Existing tenant-scoped audit and pending-review metadata endpoints."""

from fastapi import APIRouter, Request

from agents.review_queue import derive_pending_reviews, is_run_parked
from audit.store import all_records
from models.schemas import AuditRecordsResponse, PendingReviewsResponse

router = APIRouter()


@router.get("/api/audit/records")
async def list_audit_records(request: Request) -> AuditRecordsResponse:
    """List the audit trail (S3 Task 3) — read-only, metadata + hashes only.

    Authentication + tenant scoping: enforced by the auth_middleware before this
    is reached, which resolves the caller's :class:`TenancyScope` onto
    ``request.state`` (session tenant, or platform for a Bearer caller). The
    handler stays logic-free — it reads a plain value and passes it to the
    fail-closed store boundary; a session sees only its tenant's records
    (ADR-0017), a service caller sees all.
    """
    return AuditRecordsResponse(records=all_records(request.state.tenancy_scope))


@router.get("/api/reviews/pending")
async def list_pending_reviews(request: Request) -> PendingReviewsResponse:
    """List exception-tier runs awaiting human review (S3 Task 3).

    Authentication + tenant scoping: enforced by the auth_middleware, which
    resolves the caller's :class:`TenancyScope` onto ``request.state``. Metadata
    only — never the draft body (a deferred Slice 4c surface). The queue is
    derived from the audit trail (ADR-0011); the handler wires the tenant-scoped
    store snapshot and the live parked-check into the pure derivation, so the
    queue is scoped through the same fail-closed store boundary as the audit
    listing (a session sees only its tenant's parked runs; a service caller all).
    """
    return PendingReviewsResponse(
        reviews=derive_pending_reviews(all_records(request.state.tenancy_scope), is_run_parked)
    )
