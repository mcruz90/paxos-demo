"""Pydantic schema for backend/evals/fixtures/scenarios.json.

EvalScenario is the canonical labeled record for one PA denial case.
Use load_scenarios_fixture() to load and validate the fixture file.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from models.schemas import CriterionStatus, RuleType

_FIXTURE_PATH = Path(__file__).parent / "scenarios.json"


class DiscrepancySignal(BaseModel):
    """A factual observation about a potential coding or billing discrepancy.

    policy_statement must be verbatim (or near-verbatim) from the source document
    so faithfulness is evaluable.  The system surfaces the observation;
    human_action_required=True enforces that a human confirms before any action.
    """

    signal_id: str
    observation: str
    policy_statement: str
    source_ref: str
    likelihood: Literal["high", "medium", "low"]
    human_action_required: bool
    suggested_action_type: Literal[
        "review_coding_accuracy",
        "verify_clinical_criteria",
        "obtain_missing_documentation",
    ]


class SubmittedCodes(BaseModel):
    icd10: list[str]
    ndc: str | None = None


class PolicyExpectedCodes(BaseModel):
    icd10_secondary: list[str] = []
    source_ref: str
    source_text: str


class ScenarioCriterion(BaseModel):
    key: str
    label: str
    rule_type: RuleType
    ground_truth_status: CriterionStatus
    evidence_summary: str = ""


class ExpectedOutcome(BaseModel):
    appealable: bool
    resolution_path: Literal[
        "appeal",
        "corrected_claim_resubmission",
        "administrative_correction",
    ]
    primary_argument_key: str | None = None
    confidence: Literal["high", "medium", "low"]


class EvalScenario(BaseModel):
    scenario_id: str
    anchor_id: str
    denial_type: Literal["clinical_pa", "coding_error", "administrative"]
    drug: str
    payer: str
    plan_id: str
    appeal_process_ref: str
    policy_refs: list[str]
    submitted_codes: SubmittedCodes
    policy_expected_codes: PolicyExpectedCodes
    discrepancy_signals: list[DiscrepancySignal]
    criteria: list[ScenarioCriterion]
    expected_outcome: ExpectedOutcome


class ScenariosFixture(BaseModel):
    schema_version: str
    scenarios: list[EvalScenario]


def load_scenarios_fixture(path: Path = _FIXTURE_PATH) -> ScenariosFixture:
    """Load and validate the canonical scenarios fixture from *path*."""
    return ScenariosFixture.model_validate_json(path.read_text(encoding="utf-8"))
