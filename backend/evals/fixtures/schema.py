"""Pydantic schema for backend/evals/fixtures/scenarios.json.

EvalScenario is the canonical labeled record for one PA denial case.
Use load_scenarios_fixture() to load and validate the fixture file.
"""
from __future__ import annotations

from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from models.schemas import CriterionStatus, RuleType

_FIXTURE_PATH = Path(__file__).parent / "scenarios.json"


# ---------------------------------------------------------------------------
# Step 3: Claim→span grounding (claim-citation eval surface)
# ---------------------------------------------------------------------------


class GroundingRef(BaseModel):
    """Points to the synthetic document + location that grounds a criterion's evidence.

    doc_ref names one of the files produced by golden_set.generate for this anchor:
      denial_letter.txt, clinical_<ii>_<key>.txt, rx_snippet.txt
    section and line_range are optional — use whichever locates the evidence best.
    """

    doc_ref: str
    section: str | None = None
    line_range: str | None = None


# ---------------------------------------------------------------------------
# Step 4: Shared eval-dimension vocabulary
# ---------------------------------------------------------------------------


class EvalDimension(StrEnum):
    """Shared dimension names for golden labels, backend scorers (S4), and frontend rubric.

    Frontend rubric uses hyphenated names (e.g. "claim-citation"); here they are
    snake_case to be valid Python identifiers. The mapping is 1-to-1.
    """

    coverage = "coverage"          # coverage model accuracy, policy citations
    structure = "structure"        # letter structure and formatting
    safety = "safety"              # safety criteria (no concurrent GLP-1, etc.)
    claim_citation = "claim_citation"  # faithfulness: claim traceable to source document
    over_caution = "over_caution"  # refusal when appeal is clearly appropriate


# ---------------------------------------------------------------------------
# Existing models (DiscrepancySignal, SubmittedCodes, etc.)
# ---------------------------------------------------------------------------


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
    # Step 3: claim→span citation — which synthetic document grounds this criterion
    grounding: GroundingRef | None = None


class ExpectedOutcome(BaseModel):
    appealable: bool
    resolution_path: Literal[
        "appeal",
        "corrected_claim_resubmission",
        "administrative_correction",
        "security_hold",
    ]
    primary_argument_key: str | None = None
    confidence: Literal["high", "medium", "low"]
    # Step 5: redteam expected defensive behavior
    expected_security_hold: bool = False
    expected_defensive_behavior: str | None = None


class EvalScenario(BaseModel):
    scenario_id: str
    anchor_id: str
    denial_type: Literal["clinical_pa", "coding_error", "administrative", "redteam"]
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
    # Step 4: which eval dimensions this scenario exercises (empty = all applicable)
    eval_dimensions: list[EvalDimension] = []
    # Step 5: adversarial input text (redteam scenarios only)
    redteam_input_text: str | None = None


class ScenariosFixture(BaseModel):
    schema_version: str
    scenarios: list[EvalScenario]


def load_scenarios_fixture(path: Path = _FIXTURE_PATH) -> ScenariosFixture:
    """Load and validate the canonical scenarios fixture from *path*."""
    return ScenariosFixture.model_validate_json(path.read_text(encoding="utf-8"))
