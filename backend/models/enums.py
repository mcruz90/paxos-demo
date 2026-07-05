"""StrEnum types — the closed vocabularies shared across every data contract.

Split out of the former single-file ``models/schemas.py`` (DRY registry) as
the base layer of the ``models/`` package: no intra-package imports, so every
other module can depend on this one without a cycle. Re-exported through
``models.schemas`` — import from there, not from here.

These enums mirror the TypeScript unions in src/types.ts; any change here must
be reflected there and vice versa — tests/unit/test_schema_parity.py pins the
enum shapes to the frontend unions.
"""

from __future__ import annotations

from enum import StrEnum


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


class CaseTier(StrEnum):
    """Deterministic HITL review tier (S3 Slice 2). Assigned by the
    TierRouter node — pure rule logic, never an LLM (regulatory + safety
    constraint: Illinois, MD HB 1563). Mirrors the pre-existing types.ts
    union — parity-tested in test_schema_parity.py."""

    routine = "routine"
    complex = "complex"
    exception = "exception"


class ClientType(StrEnum):
    medtech = "medtech"
    patient = "patient"


class CaseLifecycle(StrEnum):
    initial_pa = "initial_pa"
    appeal = "appeal"


class AuditProvenance(StrEnum):
    """What the outbound artifact was when it left the system (S2 Slice 4).

    AI-accountability provenance (CLAUDE.md §AI Output Accountability): the
    audit trail must record what was actually verified before an artifact
    reached a payer, not just that a pipeline ran. `as_is` = machine output,
    unedited (all pipeline-boundary writes today); `gatekeeper_corrected`
    arrives with the S4 blocking claim→citation gatekeeper; `human_edited`
    arrives with the HITL review flows.
    """

    as_is = "as_is"
    gatekeeper_corrected = "gatekeeper_corrected"
    human_edited = "human_edited"


class PaDecision(StrEnum):
    """Payer determination decision on an initial-PA submission (S2 Slice 1).

    The initial-PA lifecycle branches on this: approved ends the flow,
    pended loops back to determination, denied hands off to the appeal
    pipeline (05-state-lifecycle.md).
    """

    approved = "approved"
    pended = "pended"
    denied = "denied"
