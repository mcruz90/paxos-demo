"""Unit tests — the pending-review queue derivation (S3 Task 3).

``derive_pending_reviews`` is the pure function behind
``GET /api/reviews/pending``: given the audit records and an ``is_parked``
checker, it returns the exception-tier runs still awaiting human review. It is
tested here in isolation with literal ``AuditRecord`` inputs and a fake
``is_parked`` (a set membership check) — no live checkpointer, no HTTP.

The queue-index rule (ADR-0011): a candidate is an exception-tier ``done``
audit record with **no** subsequent ``human_edited`` record for the same
``correlation_id``, confirmed **still parked** by ``is_parked``. Both filters
matter — the ``human_edited`` record is the durable "was reviewed" marker;
``is_parked`` guards against a record whose checkpoint is gone.

Run from backend/:
    uv run pytest tests/unit/test_review_queue.py -v
"""

from __future__ import annotations

from collections.abc import Callable

from agents.review_queue import derive_pending_reviews
from models.schemas import (
    AuditProvenance,
    AuditRecord,
    CaseLifecycle,
    CaseTier,
)


def _record(
    correlation_id: str,
    *,
    idempotency_key: str | None = None,
    tier: CaseTier | None = CaseTier.exception,
    outcome: str = "done",
    provenance: AuditProvenance = AuditProvenance.as_is,
    timestamp: str = "2026-07-04T12:00:00+00:00",
    scenario_id: str = "scn",
    drug: str = "Ozempic (semaglutide)",
    plan: str = "Cigna Connect 500 PPO",
) -> AuditRecord:
    return AuditRecord(
        correlation_id=correlation_id,
        idempotency_key=idempotency_key or correlation_id,
        lifecycle=CaseLifecycle.appeal,
        scenario_id=scenario_id,
        drug=drug,
        plan=plan,
        timestamp=timestamp,
        duration_ms=1,
        outcome=outcome,  # type: ignore[arg-type]
        tier=tier,
        provenance=provenance,
    )


def _parked(*ids: str) -> Callable[[str], bool]:
    parked = set(ids)
    return lambda cid: cid in parked


def test_parked_exception_run_appears() -> None:
    records = [_record("case-a:a1")]
    reviews = derive_pending_reviews(records, _parked("case-a:a1"))

    assert len(reviews) == 1
    assert reviews[0].correlation_id == "case-a:a1"
    assert reviews[0].tier == CaseTier.exception


def test_item_fields_map_from_the_audit_record() -> None:
    records = [
        _record(
            "case-b:a1",
            timestamp="2026-07-04T09:30:00+00:00",
            scenario_id="livdelzi-cigna",
            drug="Livdelzi (seladelpar)",
            plan="Cigna PPO",
        )
    ]
    item = derive_pending_reviews(records, _parked("case-b:a1"))[0]

    assert item.scenario_id == "livdelzi-cigna"
    assert item.drug == "Livdelzi (seladelpar)"
    assert item.plan == "Cigna PPO"
    assert item.parked_at == "2026-07-04T09:30:00+00:00"


def test_resumed_run_excluded_by_human_edited_record() -> None:
    """A ``human_edited`` record for the same correlation_id means the run was
    reviewed and cleared — it must drop out of the queue even if is_parked
    (defensively) still returns True."""
    records = [
        _record("case-c:a1", provenance=AuditProvenance.as_is),
        _record(
            "case-c:a1",
            idempotency_key="case-c:a1:resume",
            provenance=AuditProvenance.human_edited,
        ),
    ]
    # Even with is_parked True for the id, the human_edited marker wins.
    assert derive_pending_reviews(records, _parked("case-c:a1")) == []


def test_not_parked_run_excluded() -> None:
    """No live checkpoint (resumed/completed, or lost) ⇒ not in the queue,
    even without a human_edited record present."""
    records = [_record("case-d:a1")]
    assert derive_pending_reviews(records, _parked()) == []


def test_non_exception_tiers_excluded() -> None:
    records = [
        _record("routine:a1", tier=CaseTier.routine),
        _record("complex:a1", tier=CaseTier.complex),
    ]
    # Even if (impossibly) parked, only exception tier is a review candidate.
    assert derive_pending_reviews(records, _parked("routine:a1", "complex:a1")) == []


def test_error_runs_excluded() -> None:
    """An error run produced no artifact and carries tier=None — never queued."""
    records = [_record("err:a1", outcome="error", tier=None)]
    assert derive_pending_reviews(records, _parked("err:a1")) == []


def test_order_preserved_and_deduped() -> None:
    records = [
        _record("first:a1", timestamp="2026-07-04T08:00:00+00:00"),
        _record("second:a1", timestamp="2026-07-04T09:00:00+00:00"),
    ]
    reviews = derive_pending_reviews(records, _parked("first:a1", "second:a1"))
    assert [r.correlation_id for r in reviews] == ["first:a1", "second:a1"]


def test_empty_store_yields_empty_queue() -> None:
    assert derive_pending_reviews([], _parked()) == []
