"""etl/pas_rail/adapter.py — canonical PaSubmission → PAS/X12-278 rail shape.

Adapter pattern, outbound: the engine assembles the canonical PaSubmission
and never branches on payer or rail format; this module owns the
rail-specific shape (Da Vinci PAS wraps X12 278 in production —
CMS-0057-F). The rail shape is adapter-private by design: canonical
contracts live in models/schemas.py, source/rail-specific shapes live with
their adapter.

Stub rail: submit_to_pas_rail() performs no network I/O and returns a
deterministic submission reference — the same rail request always maps to
the same reference, so a retried request can never look like a second
submission (idempotency groundwork; enforced end-to-end with the Slice 4
AuditRecord write path).
"""

from __future__ import annotations

import hashlib
from typing import Literal

from pydantic import BaseModel

from models.schemas import PaSubmission


class PasRailRequest(BaseModel):
    """Minimal X12-278-shaped request the stub rail accepts.

    Field names follow the 278 transaction's vocabulary (transaction set,
    BHT03-style trace number); this is deliberately a stub shape, not a full
    X12 278 implementation — a real PAS connector replaces this module
    without touching engine code.
    """

    transaction_set: Literal["278"] = "278"
    # BHT03-style trace — deterministic from case identity, so retried
    # assemblies never mint a new rail identity.
    trace_number: str
    plan_id: str
    drug: str
    diagnosis: str
    requested_therapy: str
    # Attachment summary: the payer criteria the submission addresses.
    criteria_summary: str


def to_pas_request(submission: PaSubmission) -> PasRailRequest:
    """Translate the canonical submission into the PAS rail shape.

    Args:
        submission: Canonical structured PA request from the assembly node.

    Returns:
        The X12-278-shaped rail request with a deterministic trace number.
    """
    case_identity = "|".join(
        (
            submission.case_ref or submission.scenario_id,
            submission.scenario_id,
            submission.plan_id,
            submission.requested_therapy,
        )
    )
    trace_number = hashlib.sha256(case_identity.encode()).hexdigest()[:16]
    return PasRailRequest(
        trace_number=trace_number,
        plan_id=submission.plan_id,
        drug=submission.drug,
        diagnosis=submission.diagnosis,
        requested_therapy=submission.requested_therapy,
        criteria_summary=submission.pa_context,
    )


def submit_to_pas_rail(rail_request: PasRailRequest) -> str:
    """Submit to the stub PAS rail and return the payer's submission reference.

    Deterministic: the same rail request always yields the same reference.

    Args:
        rail_request: The X12-278-shaped request.

    Returns:
        Submission reference of the form ``PAS-<10 hex chars>``.
    """
    digest = hashlib.sha256(rail_request.model_dump_json().encode()).hexdigest()[:10]
    return f"PAS-{digest}"
