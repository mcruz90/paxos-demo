"""Pydantic schemas — single source of truth for all data contracts.

This module is a re-export facade over the ``models/`` package. The contracts
were split by domain (enums / domain / requests / events / pipeline / audit)
to stay under the ~300-line file cap, but ``models.schemas`` remains the one
public import point — every ``from models.schemas import X`` keeps working
unchanged. Import types from here, not from the split submodules.

These types mirror the TypeScript types in src/types.ts. Any change here
must be reflected there and vice versa — tests/unit/test_schema_parity.py
pins the enum shapes to the frontend unions.
"""

from __future__ import annotations

from models.audit import (
    AuditRecord,
    AuditRecordsResponse,
    PendingReviewItem,
    PendingReviewsResponse,
)
from models.auth import (
    LoginRequest,
    LoginResponse,
    MeResponse,
)
from models.domain import (
    AppealHandoff,
    Citation,
    ConflictSource,
    CriterionResult,
    OverriddenField,
    PaOutcome,
    PaRequired,
    PatientContext,
    PayerCounterOffer,
    PayerResponseAnalysis,
    Round2Appeal,
    Rule,
    ScenarioConfig,
    TimelineEvent,
    WorkflowPlan,
)
from models.enums import (
    AuditProvenance,
    CaseLifecycle,
    CaseStatus,
    CaseTier,
    ClientType,
    CriterionStatus,
    PaDecision,
    RuleType,
)
from models.events import (
    AppealEvent,
    ChunkEvent,
    DoneEvent,
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaEvent,
    PaResolution,
    StepEvent,
)
from models.pipeline import InitialPaState, PipelineState
from models.requests import (
    AppealRequest,
    InitialPaRequest,
    PaSubmission,
    ResumeAppealRequest,
)

__all__ = [
    # enums
    "RuleType",
    "CriterionStatus",
    "CaseStatus",
    "CaseTier",
    "ClientType",
    "CaseLifecycle",
    "AuditProvenance",
    "PaDecision",
    # domain
    "Rule",
    "WorkflowPlan",
    "Citation",
    "ConflictSource",
    "CriterionResult",
    "TimelineEvent",
    "OverriddenField",
    "PaRequired",
    "PaOutcome",
    "AppealHandoff",
    "PayerResponseAnalysis",
    "PayerCounterOffer",
    "Round2Appeal",
    "PatientContext",
    "ScenarioConfig",
    # requests
    "AppealRequest",
    "ResumeAppealRequest",
    "InitialPaRequest",
    "PaSubmission",
    # auth
    "LoginRequest",
    "LoginResponse",
    "MeResponse",
    # events
    "PaResolution",
    "StepEvent",
    "ChunkEvent",
    "DoneEvent",
    "ErrorEvent",
    "AppealEvent",
    "InitialPaDoneEvent",
    "InitialPaEvent",
    # pipeline
    "PipelineState",
    "InitialPaState",
    # audit
    "AuditRecord",
    "PendingReviewItem",
    "PendingReviewsResponse",
    "AuditRecordsResponse",
]
