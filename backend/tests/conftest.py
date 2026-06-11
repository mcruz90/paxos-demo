"""Shared pytest fixtures: MockLLMBackend and per-scenario ScenarioConfig instances."""

from __future__ import annotations

from typing import AsyncIterator

import pytest

from models.schemas import (
    AppealRequest,
    CriterionResult,
    CriterionStatus,
    PipelineState,
    Rule,
    RuleType,
    ScenarioConfig,
)

# ---------------------------------------------------------------------------
# Hardcoded minimal appeal text that passes all structural gatekeeper checks
# ---------------------------------------------------------------------------

MOCK_APPEAL_TEXT = (
    "Dear Medical Director,\n\n"
    "We are writing to formally appeal the denial of prior authorization for "
    "Ozempic (semaglutide) for the treatment of Type 2 Diabetes Mellitus.\n\n"
    "The patient meets all clinical criteria per the payer's PA policy. "
    "The denial cited 'formulary alternatives available', however the patient "
    "has failed two formulary alternatives (metformin, glipizide) as documented "
    "in the attached clinical notes.\n\n"
    "We request urgent reconsideration. Please contact our office with any "
    "additional information required.\n\nSincerely,\nClinical Team"
)


# ---------------------------------------------------------------------------
# Mock LLM backend — never calls a real model in unit/integration tests
# ---------------------------------------------------------------------------


class MockLLMBackend:
    """Drop-in replacement for OllamaBackend / GroqBackend in tests."""

    model_name: str = "mock-llm"

    async def generate_stream(self, prompt: str) -> AsyncIterator[str]:
        for word in MOCK_APPEAL_TEXT.split(" "):
            yield word + " "

    async def generate(self, prompt: str) -> str:
        return MOCK_APPEAL_TEXT


@pytest.fixture
def mock_llm() -> MockLLMBackend:
    return MockLLMBackend()


# ---------------------------------------------------------------------------
# Minimal ScenarioConfig fixture (mirrors the novo-ozempic frontend scenario)
# ---------------------------------------------------------------------------


@pytest.fixture
def criterion_found() -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
        status=CriterionStatus.found,
        note="ICD-10 E11.9 documented in chart",
        doc_source="chart:page-1",
    )


@pytest.fixture
def criterion_needs_review() -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.temporal, label="Failed 2 formulary alternatives"),
        status=CriterionStatus.needs_review,
        note="Only 1 alternative documented",
        doc_source="chart:page-2",
        suggested_action="Obtain prior treatment documentation",
    )


@pytest.fixture
def base_scenario(criterion_found: CriterionResult) -> ScenarioConfig:
    return ScenarioConfig(
        id="novo-ozempic-t2dm",
        config_file="novo-ozempic.json",
        drug="Ozempic (semaglutide)",
        manufacturer="Novo Nordisk",
        plan="BlueCross PPO",
        plan_id="BCBS-PPO-2024",
        category_key="diabetes",
        category_label="Type 2 Diabetes",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_reason="formulary alternatives available",
        client_type="commercial",
        criteria_results=[criterion_found],
        drug_key="ozempic",
        company_names=["BlueCross BlueShield"],
    )


@pytest.fixture
def exception_scenario(
    criterion_found: CriterionResult,
    criterion_needs_review: CriterionResult,
) -> ScenarioConfig:
    """A scenario with at least one needs_review criterion — triggers exception path."""
    return ScenarioConfig(
        id="novo-ozempic-exception",
        config_file="novo-ozempic.json",
        drug="Ozempic (semaglutide)",
        manufacturer="Novo Nordisk",
        plan="BlueCross PPO",
        plan_id="BCBS-PPO-2024",
        category_key="diabetes",
        category_label="Type 2 Diabetes",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_reason="formulary alternatives available",
        client_type="commercial",
        criteria_results=[criterion_found, criterion_needs_review],
        drug_key="ozempic",
        company_names=["BlueCross BlueShield"],
    )


@pytest.fixture
def make_pipeline_state(base_appeal_request: AppealRequest):
    """Factory fixture — returns a callable that builds a PipelineState with overrides.

    Usage in tests:
        def test_foo(make_pipeline_state):
            state = make_pipeline_state(appeal_text="...", pa_context="...")
    """
    def _make(
        appeal_text: str = "",
        pa_context: str = "PA requirements: step therapy required.",
        model_name: str = "",
        passed_gatekeeper: bool = False,
        retry_count: int = 0,
        errors: list | None = None,
    ) -> PipelineState:
        return {
            "request": base_appeal_request,
            "pa_context": pa_context,
            "appeal_text": appeal_text,
            "model_name": model_name,
            "passed_gatekeeper": passed_gatekeeper,
            "retry_count": retry_count,
            "errors": errors or [],
        }
    return _make


@pytest.fixture
def base_appeal_request(base_scenario: ScenarioConfig) -> AppealRequest:
    return AppealRequest(
        scenario_id="novo-ozempic-t2dm",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text=(
            "After careful review, authorization for Ozempic has been denied. "
            "Formulary alternatives are available and should be tried first."
        ),
        denial_reason="formulary alternatives available",
        plan="BlueCross PPO",
        plan_id="BCBS-PPO-2024",
        criteria_results=base_scenario.criteria_results,
        company_names=["BlueCross BlueShield"],
    )
