"""agents/review_queue.py — the parked-run review queue (S3 Task 3, ADR-0011).

Backs ``GET /api/reviews/pending``. There is no separate queue structure: the
**audit trail is the queue index** (ADR-0011). A run awaiting human review is
an exception-tier ``done`` audit record with no subsequent ``human_edited``
record for the same ``correlation_id``, confirmed still parked at its
checkpoint.

Two pieces, split by testability:

- :func:`derive_pending_reviews` — the pure derivation over ``(records,
  is_parked)``. No live checkpointer, no I/O; unit-tested with literal records
  and a fake ``is_parked``.
- :func:`is_run_parked` — the concrete checker the route wires in. It touches
  the compiled ``_PIPELINE`` checkpointer via the SAME public API
  ``run_resume`` uses (``get_state(config).next``), never InMemorySaver
  internals — so it survives the Phase 3 PostgreSQL checkpointer swap
  (ADR-0010/0011).
"""

from __future__ import annotations

from collections.abc import Callable

from langchain_core.runnables import RunnableConfig

from agents.graph import _PIPELINE
from models.schemas import (
    AuditProvenance,
    AuditRecord,
    CaseTier,
    PendingReviewItem,
)


def derive_pending_reviews(
    records: list[AuditRecord],
    is_parked: Callable[[str], bool],
) -> list[PendingReviewItem]:
    """Exception-tier runs still awaiting human review, in audit order.

    A ``correlation_id`` is pending iff:
      1. it has an exception-tier ``done`` record (the parked draft), AND
      2. no ``human_edited`` record exists for it (not yet resumed/cleared),
         AND
      3. ``is_parked(correlation_id)`` is True (checkpoint still live).

    Args:
        records: Snapshot of the audit store (order preserved).
        is_parked: Predicate — is this correlation_id still parked at a
            checkpoint awaiting resume.

    Returns:
        One :class:`PendingReviewItem` per pending run, first-seen order.
    """
    cleared = {
        r.correlation_id for r in records if r.provenance is AuditProvenance.human_edited
    }

    reviews: list[PendingReviewItem] = []
    seen: set[str] = set()
    for r in records:
        if r.outcome != "done" or r.tier is not CaseTier.exception:
            continue
        if r.correlation_id in cleared or r.correlation_id in seen:
            continue
        if not is_parked(r.correlation_id):
            continue
        seen.add(r.correlation_id)
        reviews.append(
            PendingReviewItem(
                correlation_id=r.correlation_id,
                scenario_id=r.scenario_id,
                drug=r.drug,
                plan=r.plan,
                tier=r.tier,
                parked_at=r.timestamp,
            )
        )
    return reviews


def is_run_parked(correlation_id: str) -> bool:
    """True if a run is parked at a checkpoint awaiting resume.

    Uses the checkpointer's public ``get_state(...).next`` — the same
    parked-check ``run_resume`` performs in
    [agents/resume.py](resume.py) — never InMemorySaver internals.
    """
    config: RunnableConfig = {"configurable": {"thread_id": correlation_id}}
    return bool(_PIPELINE.get_state(config).next)
