"""Pydantic schemas — single source of truth for all data contracts.

These types mirror the TypeScript types in src/App.tsx. Any change here
must be reflected there and vice versa.
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


class CriterionStatus(StrEnum):
    found = "found"
    needs_review = "needs_review"


class CaseStatus(StrEnum):
    processing = "processing"
    ready_for_review = "ready_for_review"
    exception = "exception"
    submitted = "submitted"


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


class CriterionResult(BaseModel):
    rule: Rule
    status: CriterionStatus
    note: str
    doc_source: str = Field(alias="docSource", default="")
    suggested_action: str | None = Field(alias="suggestedAction", default=None)
    workflow_plan: WorkflowPlan | None = Field(alias="workflowPlan", default=None)

    model_config = ConfigDict(populate_by_name=True)


class OverriddenField(BaseModel):
    label: str
    base: str
    override: str


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
    client_type: str = Field(alias="clientType")
    criteria_results: list[CriterionResult] = Field(alias="criteriaResults")
    citations: dict[str, Citation] = Field(default_factory=dict)
    drug_key: str = Field(alias="drugKey")
    parent_config_id: str | None = Field(alias="parentConfigId", default=None)
    overridden_fields: list[OverriddenField] | None = Field(
        alias="overriddenFields", default=None
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


# ---------------------------------------------------------------------------
# SSE event types (discriminated union)
# ---------------------------------------------------------------------------


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


class ErrorEvent(BaseModel):
    event: Literal["error"] = "error"
    message: str
    retry_count: int = 0


AppealEvent = StepEvent | ChunkEvent | DoneEvent | ErrorEvent


# ---------------------------------------------------------------------------
# Pipeline state (LangGraph TypedDict)
# ---------------------------------------------------------------------------


class PipelineState(TypedDict):
    request: AppealRequest
    pa_context: str
    appeal_text: str
    model_name: str
    passed_gatekeeper: bool
    retry_count: int
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
