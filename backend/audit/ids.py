"""audit/ids.py — correlation / idempotency ID derivations (ADR-0009).

Pure functions, no I/O. The idempotency key is derived from case identity +
submission attempt — never wall-clock time — so a retried request (client
timeout, network blip, SSE reconnect) maps onto the same logical submission
and can never double-write an audit entry or double-submit to a payer.

Pre-DB, the correlation_id deliberately coincides with the idempotency key:
one ID names the logical run across logs, terminal SSE events, and the
AuditRecord. Revisit when runs get durable storage (a per-execution ID can
then hang off the logical key).
"""

from __future__ import annotations


def derive_case_id(case_ref: str, scenario_id: str) -> str:
    """The case identity audit IDs derive from: case_ref, else scenario_id.

    Args:
        case_ref: Client case reference (may be empty).
        scenario_id: Always-present scenario identifier.

    Returns:
        The case identity string.
    """
    return case_ref or scenario_id


def derive_idempotency_key(case_id: str, attempt: int) -> str:
    """Idempotency key = case_id + submission attempt.

    Args:
        case_id: From :func:`derive_case_id`.
        attempt: Deliberate resubmission counter from the request (≥ 1).

    Returns:
        Key of the form ``<case_id>:a<attempt>``.
    """
    return f"{case_id}:a{attempt}"


def derive_resume_idempotency_key(correlation_id: str) -> str:
    """Idempotency key for a resumed exception run (S3 Slice 4b).

    A resume is the SAME logical run as the parked draft (same
    ``correlation_id``), but a DISTINCT auditable event — a human reviewed and
    cleared the letter. It therefore needs its own key so its
    ``human_edited`` record is not deduped against the draft's ``as_is``
    record. This is the first case where correlation_id and idempotency_key
    deliberately diverge (ADR-0009 anticipated it): the saga still traces
    under one correlation_id, but the resume write stands on its own.

    Args:
        correlation_id: The parked run's correlation ID (= its thread_id).

    Returns:
        Key of the form ``<correlation_id>:resume``.
    """
    return f"{correlation_id}:resume"


def derive_correlation_id(case_id: str, attempt: int) -> str:
    """Correlation ID for the logical run — coincides with the idempotency
    key pre-DB (ADR-0009).

    Args:
        case_id: From :func:`derive_case_id`.
        attempt: Deliberate resubmission counter from the request (≥ 1).

    Returns:
        The correlation ID string.
    """
    return derive_idempotency_key(case_id, attempt)
