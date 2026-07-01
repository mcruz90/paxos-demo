"""evals/fixtures_adapter.py — bridge between the golden EvalScenario shape and pipeline inputs.

EvalScenario (label shape) and AppealRequest/ScenarioConfig (pipeline-input shape) are
intentionally different schemas.  This module is the SOLE place that knows both shapes
and defines the canonical mapping between them.

Public API:
    eval_scenario_to_appeal_request(scenario) -> AppealRequest
    eval_scenario_to_scenario_config(scenario) -> ScenarioConfig
    FixturesAdapterError                        -- raised for redteam or unknown anchors
"""

from __future__ import annotations

from dataclasses import dataclass

from evals.fixtures.schema import EvalScenario, ScenarioCriterion
from models.schemas import (
    AppealRequest,
    ClientType,
    CriterionResult,
    CriterionStatus,
    Rule,
    RuleType,
    ScenarioConfig,
)


class FixturesAdapterError(ValueError):
    """Raised when an EvalScenario cannot be adapted to a pipeline-input shape.

    Causes: redteam scenarios (adversarial inputs, not pipeline inputs),
    or an anchor_id not registered in _ANCHOR_META.
    """


# ---------------------------------------------------------------------------
# Per-anchor metadata — fields not present in EvalScenario
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _AnchorMeta:
    manufacturer: str
    config_file: str   # frontend configFile key, e.g. "ozempic_cigna_base.json"
    drug_key: str      # short drug key for retrieval lookup
    category_key: str
    category_label: str
    diagnosis: str     # canonical clinical diagnosis string (matches MOCK_APPEAL_TEXT / ETL output)


_ANCHOR_META: dict[str, _AnchorMeta] = {
    "ozempic_cigna": _AnchorMeta(
        manufacturer="Novo Nordisk",
        config_file="ozempic_cigna_base.json",
        drug_key="ozempic",
        category_key="endocrinology",
        category_label="Endocrinology",
        diagnosis="Type 2 Diabetes Mellitus",
    ),
    "esomeprazole_uhc_pediatric": _AnchorMeta(
        manufacturer="AstraZeneca",
        config_file="esomeprazole_uhc_pediatric.json",
        drug_key="esomeprazole",
        category_key="gastroenterology",
        category_label="Gastroenterology",
        diagnosis="GERD with erosive esophagitis (K21.0)",
    ),
    "livdelzi_cigna_hepatology": _AnchorMeta(
        manufacturer="Gilead Sciences",
        config_file="livdelzi_cigna_hepatology.json",
        drug_key="livdelzi",
        category_key="hepatology",
        category_label="Hepatology",
        diagnosis="Primary Biliary Cholangitis (K74.3)",
    ),
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _require_meta(anchor_id: str) -> _AnchorMeta:
    if anchor_id not in _ANCHOR_META:
        raise FixturesAdapterError(
            f"unknown anchor_id {anchor_id!r}: "
            "add an entry to _ANCHOR_META in evals/fixtures_adapter.py"
        )
    return _ANCHOR_META[anchor_id]


def _guard_not_redteam(scenario: EvalScenario) -> None:
    if scenario.denial_type == "redteam":
        raise FixturesAdapterError(
            f"redteam scenario {scenario.scenario_id!r} cannot be adapted to a pipeline input: "
            "adversarial inputs must not enter the appeal generation path"
        )


def _normalize_scenario_id(scenario_id: str) -> str:
    """Normalize EvalScenario.scenario_id to the AppealRequest pattern (^[a-z0-9\\-]+$)."""
    return scenario_id.replace("_", "-")


def _criterion_to_result(c: ScenarioCriterion) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType(c.rule_type), label=c.label),
        status=CriterionStatus(c.ground_truth_status),
        note=c.evidence_summary,
        docSource=c.grounding.doc_ref if c.grounding else "",
    )


def _derive_denial_reason(scenario: EvalScenario) -> str:
    """Derive a short denial_reason from the unmet criterion or the first discrepancy signal."""
    primary_key = scenario.expected_outcome.primary_argument_key
    if primary_key:
        for c in scenario.criteria:
            if c.key == primary_key:
                return c.label
    if scenario.discrepancy_signals:
        return scenario.discrepancy_signals[0].observation
    return "Prior authorization requirements not met"


def _derive_denial_text(scenario: EvalScenario) -> str:
    """Synthesize a minimal denial text suitable for the synthesis prompt context."""
    reason = _derive_denial_reason(scenario)
    return (
        f"PRIOR AUTHORIZATION DETERMINATION\n"
        f"{scenario.payer}\n\n"
        f"DETERMINATION: DENIED\n\n"
        f"Authorization for {scenario.drug} has been denied.\n"
        f"Reason: {reason}\n\n"
        f"[Synthetic document — scenario {scenario.scenario_id}]"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def eval_scenario_to_appeal_request(eval_scenario: EvalScenario) -> AppealRequest:
    """Map a golden EvalScenario to an AppealRequest suitable for the pipeline.

    Raises:
        FixturesAdapterError: For redteam scenarios or unknown anchor_id values.
    """
    _guard_not_redteam(eval_scenario)
    meta = _require_meta(eval_scenario.anchor_id)

    return AppealRequest(
        scenario_id=_normalize_scenario_id(eval_scenario.scenario_id),
        drug=eval_scenario.drug,
        diagnosis=meta.diagnosis,
        denial_text=_derive_denial_text(eval_scenario)[:5000],
        denial_reason=_derive_denial_reason(eval_scenario)[:500],
        plan=eval_scenario.payer,
        plan_id=eval_scenario.plan_id,
        criteria_results=[_criterion_to_result(c) for c in eval_scenario.criteria],
        company_names=[eval_scenario.payer],
    )


def eval_scenario_to_scenario_config(eval_scenario: EvalScenario) -> ScenarioConfig:
    """Map a golden EvalScenario to a ScenarioConfig suitable for evals and conftest fixtures.

    Raises:
        FixturesAdapterError: For redteam scenarios or unknown anchor_id values.
    """
    _guard_not_redteam(eval_scenario)
    meta = _require_meta(eval_scenario.anchor_id)

    return ScenarioConfig(
        id=eval_scenario.scenario_id,
        configFile=meta.config_file,
        drug=eval_scenario.drug,
        manufacturer=meta.manufacturer,
        plan=eval_scenario.payer,
        planId=eval_scenario.plan_id,
        categoryKey=meta.category_key,
        categoryLabel=meta.category_label,
        diagnosis=meta.diagnosis,
        denialReason=_derive_denial_reason(eval_scenario)[:500],
        clientType=ClientType.patient,
        criteriaResults=[_criterion_to_result(c) for c in eval_scenario.criteria],
        drugKey=meta.drug_key,
        company_names=[eval_scenario.payer],
    )
