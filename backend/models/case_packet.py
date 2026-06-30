"""CasePacket domain models — the enriched case record for one PA denial.

These types are additive to models/schemas.py (which holds the pipeline-facing
schemas). CasePacket is the golden-set output model; it is not yet wired into
the live pipeline (that is S1 work).

Import from here, not from models/__init__ directly, when you need the sub-models.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from models.schemas import ClientType, PatientContext, TimelineEvent  # noqa: F401 (re-exported)

# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class HubClient(BaseModel):
    """The hub / submitting client associated with this case."""

    client_id: str
    name: str
    type: ClientType  # medtech | patient
    letterhead_name: str


class Coverage(BaseModel):
    """Single coverage layer (primary or secondary)."""

    payer: str
    plan_type: Literal["commercial", "medicare_advantage", "medicaid", "individual"]
    plan_id: str
    member_id: str
    group_id: str
    bin: str
    pcn: str
    effective_date: str  # YYYY-MM-DD


class PlanFinancials(BaseModel):
    """Benefit-year cost-share snapshot for affordability triage."""

    deductible: Annotated[float, Field(ge=0)]
    deductible_met: Annotated[float, Field(ge=0)]
    oop_max: Annotated[float, Field(ge=0)]
    oop_met: Annotated[float, Field(ge=0)]
    coinsurance_pct: Annotated[float, Field(ge=0, le=100)]


class CoverageInfo(BaseModel):
    """Primary + optional secondary coverage with COB metadata."""

    primary: Coverage
    secondary: Coverage | None = None
    # "medicaid_last_resort" | "birthday_rule" | None
    cob_type: str | None = None
    financials: PlanFinancials | None = None


class RxDetail(BaseModel):
    """Prescription details for the drug under PA."""

    drug: str
    ndc: str
    dose: str
    sig: str
    quantity: float
    days_supply: int
    refills: int
    written_date: str  # YYYY-MM-DD
    pharmacy: str


class LabResult(BaseModel):
    """One lab/diagnostic result relevant to the PA criteria."""

    name: str
    loinc: str | None = None  # LOINC code when known
    value: str
    unit: str
    ref_range: str
    collected_date: str  # YYYY-MM-DD
    abnormal_flag: bool


# PaHistoryEvent aligns to TimelineEvent — no parallel schema (see models/schemas.py).
# Simple assignment so PaHistoryEvent is callable at runtime (Python 3.12 `type`
# keyword creates a non-callable TypeAliasType; plain assignment avoids that).
PaHistoryEvent = TimelineEvent


# ---------------------------------------------------------------------------
# CasePacket — the enriched case record
# ---------------------------------------------------------------------------


class CasePacket(BaseModel):
    """Complete, labeled case packet: the unit of work for eval and appeal generation.

    Builds on top of EvalScenario (eval labels) by adding the full clinical +
    coverage + Rx context needed to produce and evaluate an appeal letter.
    """

    case_id: str
    hub: HubClient
    patient: PatientContext
    coverage: CoverageInfo
    rx: RxDetail
    labs: list[LabResult] = Field(default_factory=list)
    pa_history: list[PaHistoryEvent] = Field(default_factory=list)
