"""API request / response types — strict-validated HTTP boundary bodies.

Depends on ``models.domain`` (CriterionResult). Re-exported through
``models.schemas`` — import from there, not from here.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from models.domain import CriterionResult


class AppealRequest(BaseModel):
    """Strict-validated HTTP request body for POST /api/appeal/generate."""

    model_config = ConfigDict(strict=True)

    scenario_id: Annotated[str, Field(max_length=64, pattern=r"^[a-z0-9\-]+$")]
    drug: Annotated[str, Field(max_length=200)]
    diagnosis: Annotated[str, Field(max_length=200)]
    denial_text: Annotated[str, Field(max_length=5000)]
    denial_reason: Annotated[str, Field(max_length=500)]
    plan: Annotated[str, Field(max_length=200)]
    plan_id: Annotated[str, Field(max_length=100)]
    criteria_results: list[CriterionResult]
    company_names: list[str] = Field(default_factory=list)
    # Deliberate resubmission counter — part of the audit idempotency key
    # (case_id + attempt, ADR-0009). A transport retry reuses the same attempt;
    # a client bumps it to file the same case again on purpose.
    attempt: Annotated[int, Field(ge=1)] = 1
    # Set by ETL pipeline when hidden/suspicious content is detected in source document.
    # Not expected from HTTP clients — defaults to False on inbound requests.
    security_hold: bool = False
    security_reason: str = ""


class ResumeAppealRequest(BaseModel):
    """Strict-validated HTTP request body for POST /api/appeal/resume (S3
    Slice 4b): a human clears a parked exception-tier run for submission.

    ``correlation_id`` is the parked run's handle — the value carried on that
    run's terminal ``DoneEvent`` (= its checkpoint ``thread_id``). When
    ``edited_text`` is present it replaces the drafted letter as the outbound
    artifact; the resume is recorded with ``provenance=human_edited``.
    """

    model_config = ConfigDict(strict=True)

    correlation_id: Annotated[str, Field(min_length=1, max_length=200)]
    # The human-reviewed letter body. None ⇒ approve the machine draft as-is.
    edited_text: Annotated[str, Field(max_length=20000)] | None = None


class InitialPaRequest(BaseModel):
    """Strict-validated HTTP request body for the initial-PA lifecycle (S2).

    Deliberately NOT an AppealRequest extension (Sprint 2 standing rule): an
    initial PA precedes any payer decision, so there is no denial to quote,
    and the flow it drives (CRD check → assemble → PAS submit → determination)
    is a different artifact on a different transmission rail
    (05-state-lifecycle.md).
    """

    model_config = ConfigDict(strict=True)

    scenario_id: Annotated[str, Field(max_length=64, pattern=r"^[a-z0-9\-]+$")]
    # Client-side case reference the PA is filed under (e.g. "PA-2026-0847").
    # A denied PA's appeal continues this reference (AppealHandoff.case_ref),
    # and Slice 4 derives the audit idempotency key from it; falls back to
    # scenario_id when empty.
    case_ref: Annotated[str, Field(max_length=64, pattern=r"^[A-Za-z0-9\-]*$")] = ""
    drug: Annotated[str, Field(max_length=200)]
    diagnosis: Annotated[str, Field(max_length=200)]
    plan: Annotated[str, Field(max_length=200)]
    plan_id: Annotated[str, Field(max_length=100)]
    # The therapy the structured PA request asks the payer to authorize.
    requested_therapy: Annotated[str, Field(max_length=200)]
    criteria_results: list[CriterionResult]
    # Deliberate resubmission counter — part of the audit idempotency key
    # (case_id + attempt, ADR-0009).
    attempt: Annotated[int, Field(ge=1)] = 1
    # Set by ETL pipeline when hidden/suspicious content is detected in source
    # documents. Same detection flag as AppealRequest — the pipeline gate is
    # the single enforcement point for both lifecycles.
    security_hold: bool = False
    security_reason: str = ""


class PaSubmission(BaseModel):
    """Canonical structured PA request assembled by the pa_assembly node (S2).

    Canonical shape only: the PAS/X12-278 rail shape is produced by the rail
    adapter (adapter pattern — canonical in, rail shape out; engine code never
    branches on payer or rail format).
    """

    case_ref: str
    scenario_id: str
    drug: str
    diagnosis: str
    plan_id: str
    requested_therapy: str
    # Chart evidence attached to the submission.
    criteria_evidence: list[CriterionResult]
    # The payer criteria the submission addresses (CRD-resolved).
    pa_context: str
