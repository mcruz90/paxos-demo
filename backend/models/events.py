"""SSE event types (discriminated union) — the appeal + initial-PA streams.

Depends on ``models.enums`` (CaseTier) and ``models.domain`` (PaRequired,
PaOutcome, AppealHandoff). ``PaResolution`` is defined here and reused by
``models.pipeline`` and ``models.audit``. Re-exported through
``models.schemas`` — import from there, not from here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from models.domain import AppealHandoff, PaOutcome, PaRequired
from models.enums import CaseTier

# Which retrieval resolution path produced the PA context ("" before retrieval).
PaResolution = Literal["plan_id", "drug_alias", "generic", ""]


class StepEvent(BaseModel):
    event: Literal["step"] = "step"
    step: str
    label: str


class ChunkEvent(BaseModel):
    event: Literal["chunk"] = "chunk"
    text: str


class DoneEvent(BaseModel):
    event: Literal["done"] = "done"
    model: str
    ref: str
    structural_scores: dict[str, float] = Field(default_factory=dict)
    # A generic-fallback letter is a materially different artifact from a
    # payer-specific one; the audit trail must be able to tell them apart.
    pa_resolution: PaResolution = ""
    # Gatekeeper retries that preceded the pass ("passed after N retries" is
    # a quality signal the audit trail records; S2 Slice 4).
    retry_count: int = 0
    # Deterministic HITL review tier the TierRouter assigned (S3 Slice 3):
    # routine → streamlined approval, complex → full-letter review, exception
    # → escalation. None only on a pre-tier terminal (there is none on the
    # done path — finalize runs after tier_router — but the default keeps the
    # field additive, like correlation_id/pa_resolution were in S2 Slice 4).
    tier: CaseTier | None = None
    # Stamped at the pipeline boundary; equals the AuditRecord's
    # correlation_id, so a client can reference its run end-to-end (ADR-0009).
    correlation_id: str = ""


class ErrorEvent(BaseModel):
    event: Literal["error"] = "error"
    message: str
    retry_count: int = 0
    # Stamped at the pipeline boundary (ADR-0009); "" only for pre-pipeline
    # failures (e.g. backend construction in main.py).
    correlation_id: str = ""


AppealEvent = StepEvent | ChunkEvent | DoneEvent | ErrorEvent


class InitialPaDoneEvent(BaseModel):
    """Success terminal for the initial-PA stream (S2 Slice 1, spec-first).

    Same ``done``/``error`` contract as the appeal stream — every stream ends
    with exactly one of them — but lifecycle-shaped payload: the CRD result,
    the payer determination (absent when the CRD early-exits with "PA not
    required"), and the appeal handoff pointer when denied. Launching the
    appeal stays a separate, human-gated request.
    """

    event: Literal["done"] = "done"
    pa_required: PaRequired
    # None ⇔ CRD early exit (pa_required.required is False) — no submission.
    outcome: PaOutcome | None = None
    # Present iff outcome.decision is denied.
    appeal_handoff: AppealHandoff | None = None
    # PAS rail submission reference ("" until the stub rail assigns one, Slice 3).
    submission_ref: str = ""
    # Which retrieval path produced the PA criteria (audit-relevant, hard-5).
    pa_resolution: PaResolution = ""
    # Stamped at the pipeline boundary; equals the AuditRecord's
    # correlation_id (ADR-0009).
    correlation_id: str = ""


# The initial-PA stream never emits chunks: there is no LLM in this path.
InitialPaEvent = StepEvent | InitialPaDoneEvent | ErrorEvent
