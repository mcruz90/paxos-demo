"""audit/records.py — the shared AuditRecord builder for the appeal lifecycle.

Both appeal entrypoints — [agents/generate.py](../agents/generate.py) (fresh
run) and [agents/resume.py](../agents/resume.py) (human-review resume) — write
one :class:`AuditRecord` per run through the audit boundary. Their record
construction is field-for-field identical except for three run-specific values:

  * ``provenance`` — ``as_is`` for machine output, ``human_edited`` for a resume,
  * ``model_name_fallback`` — the generating backend's name on an error terminal
    (the resume path invokes no model, so its fallback is ``""``),
  * ``reviewed_by`` — the human reviewer on a resume, ``""`` for a service run.

Extracted here (DRY, second occurrence) so the two closures stay one-liners and
the AuditRecord shape has a single construction site. Lives in ``audit/`` rather
than ``models/`` because it is logic (event → record mapping), not a schema.
"""

from __future__ import annotations

from datetime import UTC, datetime

from models.schemas import (
    AppealEvent,
    AppealRequest,
    AuditProvenance,
    AuditRecord,
    CaseLifecycle,
    DoneEvent,
    ErrorEvent,
)


def build_audit_record(
    *,
    event: AppealEvent,
    duration_ms: int,
    correlation_id: str,
    idempotency_key: str,
    request: AppealRequest,
    provenance: AuditProvenance,
    model_name_fallback: str = "",
    reviewed_by: str = "",
) -> AuditRecord:
    """Record the human decision and the gate verdict for the terminal event."""
    done = event if isinstance(event, DoneEvent) else None
    error = event if isinstance(event, ErrorEvent) else None
    resume_gate = event.resume_gate if isinstance(event, (DoneEvent, ErrorEvent)) else None
    return AuditRecord(
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
        # Tenancy seam (ADR-0017): stamp the owning tenant + patient token from
        # the originating request (seeded default pre-DB) — a scoping column,
        # not part of the correlation/idempotency identity.
        tenant_id=request.tenant_id,
        patient_ref=request.patient_ref,
        lifecycle=CaseLifecycle.appeal,
        scenario_id=request.scenario_id,
        drug=request.drug,
        plan=request.plan,
        denial_reason=request.denial_reason,
        timestamp=datetime.now(UTC).isoformat(),
        duration_ms=duration_ms,
        outcome="done" if done else "error",
        model_name=done.model if done else model_name_fallback,
        artifact_ref=done.ref if done else "",
        resume_gate=resume_gate,
        gatekeeper_passed=(
            resume_gate in ("edit_passed", "draft_reused") if resume_gate else done is not None
        ),
        retry_count=done.retry_count if done else (error.retry_count if error else 0),
        structural_eval_scores=done.structural_scores if done else {},
        pa_resolution=done.pa_resolution if done else "",
        tier=done.tier if done else None,
        provenance=provenance,
        reviewed_by=reviewed_by,
    )
