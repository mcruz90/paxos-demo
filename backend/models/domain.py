"""Domain models — the case/criteria/scenario shapes the pipeline reasons over.

Second layer of the ``models/`` package: depends only on ``models.enums``.
Re-exported through ``models.schemas`` — import from there, not from here.

These types mirror the TypeScript types in src/types.ts; any change here must
be reflected there and vice versa.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from models.enums import (
    CaseLifecycle,
    ClientType,
    CriterionStatus,
    PaDecision,
    RuleType,
)


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
    # Confidence (0-1) that the finding is correct AND complete enough to act
    # on without human input — what the TierRouter bands route against
    # (S3: >=0.95 routine, 0.70-0.94 complex, <0.70 exception). None means
    # 'not assessed' and routes to exception; never defaults to 1.0.
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

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
