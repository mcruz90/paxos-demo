"""Pipeline state (LangGraph TypedDict) — the in-flight single source of truth.

Depends on ``models.requests`` (AppealRequest, InitialPaRequest, PaSubmission),
``models.domain`` (PaRequired, PaOutcome, AppealHandoff), ``models.events``
(PaResolution) and ``models.enums`` (CaseTier). Re-exported through
``models.schemas`` — import from there, not from here.

LangGraph checkpoint deserialization (the resume path) resolves these
annotations against this module's namespace, so every referenced class is
imported here, not just forward-referenced.
"""

from __future__ import annotations

from typing import TypedDict

from models.domain import AppealHandoff, PaOutcome, PaRequired
from models.enums import CaseTier
from models.events import PaResolution
from models.requests import AppealRequest, InitialPaRequest, PaSubmission


class PipelineState(TypedDict):
    request: AppealRequest
    pa_context: str
    # Set by retrieval ("" before retrieval runs)
    pa_resolution: PaResolution
    appeal_text: str
    model_name: str
    passed_gatekeeper: bool
    retry_count: int
    errors: list[str]
    # Set by tier_router (None until it runs — never a default tier)
    tier: CaseTier | None


class InitialPaState(TypedDict):
    """State for the initial-PA StateGraph (S2) — the full lifecycle shape,
    spec-first: crd_check/pa_assembly fill the top group (Slice 2);
    pas_submit/determination fill the bottom group (Slice 3)."""

    request: InitialPaRequest
    # Set by crd_check (None before it runs)
    pa_required: PaRequired | None
    pa_context: str
    pa_resolution: PaResolution
    # Set by pa_assembly
    submission: PaSubmission | None
    # Set by pas_submit ("" before the stub rail assigns one)
    submission_ref: str
    # Set by determination
    outcome: PaOutcome | None
    appeal_handoff: AppealHandoff | None
    # Completed pend/info-request cycles (bounded — the pended loop must terminate)
    pend_cycles: int
    errors: list[str]
