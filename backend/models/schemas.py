"""Pydantic schemas — single source of truth for all data contracts.

These types mirror the TypeScript types in src/types.ts. Any change here
must be reflected there and vice versa — tests/unit/test_schema_parity.py
pins the enum shapes to the frontend unions.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class RuleType(StrEnum):
    diagnostic = "diagnostic"
    temporal = "temporal"
    math = "math"
    safety = "safety"
    provider = "provider"
    quantity = "quantity"
    custom = "custom"


class CriterionStatus(StrEnum):
    found = "found"
    needs_review = "needs_review"
    conflict = "conflict"


class CaseStatus(StrEnum):
    processing = "processing"
    ready_for_review = "ready_for_review"
    exception = "exception"
    # Pre-submission doc gap — distinct from a payer denial (PH-3101 flow).
    awaiting_documentation = "awaiting_documentation"
    submitted = "submitted"
    payer_response = "payer_response"


class ClientType(StrEnum):
    medtech = "medtech"
    patient = "patient"


class CaseLifecycle(StrEnum):
    initial_pa = "initial_pa"
    appeal = "appeal"


class PaDecision(StrEnum):
    """Payer determination decision on an initial-PA submission (S2 Slice 1).

    The initial-PA lifecycle branches on this: approved ends the flow,
    pended loops back to determination, denied hands off to the appeal
    pipeline (05-state-lifecycle.md).
    """

    approved = "approved"
    pended = "pended"
    denied = "denied"


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


class Rule(BaseModel):
    type: RuleType
    label: str


class WorkflowPlan(BaseModel):
    action: str
    recipient: str
    channel: str
    turnaround: str


class Citation(BaseModel):
    source: str
    page: str
    text: str


class ConflictSource(BaseModel):
    """One side of a 'conflict' criterion — a source and the claim it asserts.

    Surfaced (instead of silently picking one) when two documents disagree.
    """

    source: str
    claim: str


class CriterionResult(BaseModel):
    rule: Rule
    status: CriterionStatus
    note: str
    doc_source: str = Field(alias="docSource", default="")
    suggested_action: str | None = Field(alias="suggestedAction", default=None)
    workflow_plan: WorkflowPlan | None = Field(alias="workflowPlan", default=None)
    # For status 'conflict': the contradictory source claims, surfaced rather than resolved.
    conflict_sources: list[ConflictSource] | None = Field(alias="conflictSources", default=None)

    model_config = ConfigDict(populate_by_name=True)


class TimelineEvent(BaseModel):
    label: str
    date: str
    note: str | None = None
    status: Literal["done", "flagged", "pending"]


class OverriddenField(BaseModel):
    label: str
    base: str
    override: str


class PaRequired(BaseModel):
    """CRD pre-check result: is a PA required for this drug × plan, and why."""

    required: bool
    basis: str


class PaOutcome(BaseModel):
    """Payer determination after a PAS submission (initial-PA lifecycle)."""

    decision: PaDecision
    determination_id: str = Field(alias="determinationId")
    time_to_therapy: str = Field(alias="timeToTherapy")
    note: str

    model_config = ConfigDict(populate_by_name=True)


class AppealHandoff(BaseModel):
    """Initial-PA denial → appeal handoff: which appeal scenario to launch."""

    scenario_id: str = Field(alias="scenarioId")
    case_ref: str = Field(alias="caseRef")

    model_config = ConfigDict(populate_by_name=True)


class PayerResponseAnalysis(BaseModel):
    response_type: Literal[
        "partial_approval", "full_denial", "full_approval", "info_request"
    ] = Field(alias="responseType")
    ai_flag: str = Field(alias="aiFlag")
    ai_rationale: str = Field(alias="aiRationale")
    cta_accept: str = Field(alias="ctaAccept")
    cta_dispute: str = Field(alias="ctaDispute")

    model_config = ConfigDict(populate_by_name=True)


class PayerCounterOffer(BaseModel):
    date: str
    summary: str
    new_denial_reason: str = Field(alias="newDenialReason")
    approved_dose: str = Field(alias="approvedDose")

    model_config = ConfigDict(populate_by_name=True)


class Round2Appeal(BaseModel):
    key_argument: str = Field(alias="keyArgument")
    guideline_ref: str = Field(alias="guidelineRef")
    guideline_pmid: str = Field(alias="guidelinePMID")
    required_dose: str = Field(alias="requiredDose")

    model_config = ConfigDict(populate_by_name=True)


class PatientContext(BaseModel):
    """Synthetic patient + prescriber demographics for letter headers.

    In the golden set these values come from the closed IDENTITY_POOL
    (synthetic-by-construction, never real PHI).  In production this is the
    one legitimate PHI sink; everything else must pass through redact_phi().
    """

    patient_name: str
    patient_dob: str           # YYYY-MM-DD
    patient_sex: str           # "M" | "F"
    member_id: str
    group_id: str
    patient_address: str
    prescriber_name: str
    prescriber_npi: str        # 10-digit string (fake in golden set)
    prescriber_specialty: str
    prescriber_address: str
    prescriber_phone: str


class ScenarioConfig(BaseModel):
    id: str
    config_file: str = Field(alias="configFile")
    drug: str
    manufacturer: str
    plan: str
    plan_id: str = Field(alias="planId")
    category_key: str = Field(alias="categoryKey")
    category_label: str = Field(alias="categoryLabel")
    diagnosis: str
    denial_reason: str = Field(alias="denialReason")
    client_type: ClientType = Field(alias="clientType")
    criteria_results: list[CriterionResult] = Field(alias="criteriaResults")
    citations: dict[str, Citation] = Field(default_factory=dict)
    config_json: str = Field(alias="configJson", default="")
    drug_key: str = Field(alias="drugKey")
    parent_config_id: str | None = Field(alias="parentConfigId", default=None)
    overridden_fields: list[OverriddenField] | None = Field(
        alias="overriddenFields", default=None
    )
    # Multi-round appeal support (optional — appeal scenarios only)
    payer_counter_offer: PayerCounterOffer | None = Field(
        alias="payerCounterOffer", default=None
    )
    round2_appeal: Round2Appeal | None = Field(alias="round2Appeal", default=None)
    # Initial-PA lifecycle (optional — absent ⇒ this is an appeal scenario)
    lifecycle: CaseLifecycle | None = None
    pa_required: PaRequired | None = Field(alias="paRequired", default=None)
    requested_therapy: str | None = Field(alias="requestedTherapy", default=None)
    pa_outcome: PaOutcome | None = Field(alias="paOutcome", default=None)
    appeal_handoff: AppealHandoff | None = Field(alias="appealHandoff", default=None)
    timeline: list[TimelineEvent] | None = None
    payer_response_analysis: PayerResponseAnalysis | None = Field(
        alias="payerResponseAnalysis", default=None
    )
    # Injected by synthesis node — not from frontend
    company_names: list[str] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


# ---------------------------------------------------------------------------
# API request / response types
# ---------------------------------------------------------------------------


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
    # Set by ETL pipeline when hidden/suspicious content is detected in source document.
    # Not expected from HTTP clients — defaults to False on inbound requests.
    security_hold: bool = False
    security_reason: str = ""


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


# ---------------------------------------------------------------------------
# SSE event types (discriminated union)
# ---------------------------------------------------------------------------


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


class ErrorEvent(BaseModel):
    event: Literal["error"] = "error"
    message: str
    retry_count: int = 0


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


# The initial-PA stream never emits chunks: there is no LLM in this path.
InitialPaEvent = StepEvent | InitialPaDoneEvent | ErrorEvent


# ---------------------------------------------------------------------------
# Pipeline state (LangGraph TypedDict)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Audit record (in-memory pre-DB)
# ---------------------------------------------------------------------------


class AuditRecord(BaseModel):
    scenario_id: str
    drug: str
    plan: str
    denial_reason: str
    timestamp: str
    duration_ms: int
    model_name: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    appeal_text_hash: str
    gatekeeper_passed: bool
    retry_count: int
    structural_eval_scores: dict[str, float] = Field(default_factory=dict)
