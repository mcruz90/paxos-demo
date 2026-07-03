"""Shared pytest fixtures derived from the golden set — single source of truth.

All scenario/criteria fixtures are derived from evals/fixtures/scenarios.json
via the adapter in evals/fixtures_adapter.py.  No hardcoded BlueCross/BCBS
data remains here; that drift was deferred from Sprint 0.A and is cleared
by this Slice-5 refactor.

Fixture names are STABLE across refactors so downstream tests don't churn:
    criterion_found, criterion_needs_review,
    base_scenario, exception_scenario,
    base_appeal_request, make_pipeline_state, mock_llm
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from evals.fixtures.schema import EvalScenario, load_scenarios_fixture
from evals.fixtures_adapter import (
    eval_scenario_to_appeal_request,
    eval_scenario_to_scenario_config,
)
from models.schemas import (
    AppealRequest,
    CriterionResult,
    CriterionStatus,
    PaResolution,
    PipelineState,
    ScenarioConfig,
)

# ---------------------------------------------------------------------------
# Hardcoded minimal appeal text that passes all structural gatekeeper checks.
# Must mention "Ozempic (semaglutide)" and "Type 2 Diabetes Mellitus" since
# base_scenario is the ozempic_cigna golden anchor.
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
# Golden set — load once at import time (cheap: ~0.1 ms, no network)
# ---------------------------------------------------------------------------

_fixture = load_scenarios_fixture()
_OZEMPIC_SCENARIO: EvalScenario = next(
    s for s in _fixture.scenarios if s.scenario_id == "ozempic_cigna_clinical_pa"
)
_LIVDELZI_SCENARIO: EvalScenario = next(
    s for s in _fixture.scenarios if s.scenario_id == "livdelzi_cigna_hepatology_clinical_pa"
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
# ScenarioConfig + criteria fixtures derived from golden ozempic_cigna scenario
# ---------------------------------------------------------------------------

# Eager derivation (function-level is fine; adapter calls are pure and cheap)
_BASE_SCENARIO_CONFIG: ScenarioConfig = eval_scenario_to_scenario_config(_OZEMPIC_SCENARIO)
_EXCEPTION_SCENARIO_CONFIG: ScenarioConfig = eval_scenario_to_scenario_config(_LIVDELZI_SCENARIO)

# Pull found / needs_review criteria once from the derived config
_FOUND_CRITERIA = [
    cr for cr in _BASE_SCENARIO_CONFIG.criteria_results
    if cr.status == CriterionStatus.found
]
_NEEDS_REVIEW_CRITERIA = [
    cr for cr in _BASE_SCENARIO_CONFIG.criteria_results
    if cr.status == CriterionStatus.needs_review
]


@pytest.fixture
def criterion_found() -> CriterionResult:
    """First 'found' criterion from the golden ozempic_cigna scenario."""
    return _FOUND_CRITERIA[0]


@pytest.fixture
def criterion_needs_review() -> CriterionResult:
    """The 'needs_review' criterion from the golden ozempic_cigna scenario."""
    return _NEEDS_REVIEW_CRITERIA[0]


@pytest.fixture
def base_scenario() -> ScenarioConfig:
    """ScenarioConfig for Ozempic/Cigna, derived from the golden set (4 criteria)."""
    return _BASE_SCENARIO_CONFIG


@pytest.fixture
def exception_scenario() -> ScenarioConfig:
    """Scenario with at least one needs_review criterion (triggers exception path).

    Derived from the golden livdelzi_cigna_hepatology scenario — a distinct
    anchor from base_scenario (Ozempic/Cigna) so tests requesting both fixtures
    exercise genuinely different data, not the same object twice. Has 3 'found'
    + 1 'needs_review' (UDCA trial duration), satisfying the contract of
    'at least one non-found criterion'.
    """
    return _EXCEPTION_SCENARIO_CONFIG


# ---------------------------------------------------------------------------
# AppealRequest fixture
# ---------------------------------------------------------------------------

_BASE_APPEAL_REQUEST: AppealRequest = eval_scenario_to_appeal_request(_OZEMPIC_SCENARIO)


@pytest.fixture
def base_appeal_request() -> AppealRequest:
    """AppealRequest for Ozempic/Cigna, derived from the golden set.

    plan_id is CIGNA-CNF360-2024 (the canonical Cigna cnf_360 pack).
    retrieval.py resolves this to the correct Cigna Ozempic PA criteria.
    """
    return _BASE_APPEAL_REQUEST


# ---------------------------------------------------------------------------
# Pipeline state factory
# ---------------------------------------------------------------------------


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
        pa_resolution: PaResolution = "plan_id",
        model_name: str = "",
        passed_gatekeeper: bool = False,
        retry_count: int = 0,
        errors: list | None = None,
    ) -> PipelineState:
        return {
            "request": base_appeal_request,
            "pa_context": pa_context,
            "pa_resolution": pa_resolution,
            "appeal_text": appeal_text,
            "model_name": model_name,
            "passed_gatekeeper": passed_gatekeeper,
            "retry_count": retry_count,
            "errors": errors or [],
            "tier": None,
        }
    return _make
