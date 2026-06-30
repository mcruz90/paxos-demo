"""RED tests for Steps 3-4 — grounding refs (claim→span citations) and
shared eval-dimension vocabulary.

Exercises:
  Step 3: GroundingRef model + ScenarioCriterion.grounding field
  Step 4: EvalDimension enum + EvalScenario.eval_dimensions field

The dimension names must match the frontend rubric (coverage, structure, safety,
claim_citation, over_caution) so golden labels ↔ backend scorers ↔ frontend rubric
share ONE vocabulary.

Run from backend/:
    uv run pytest tests/unit/test_eval_enrichment.py -v
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

_FRONTEND_RUBRIC_DIMENSIONS = {"coverage", "structure", "safety", "claim_citation", "over_caution"}

# ── STEP 3: GroundingRef import gate ──────────────────────────────────────────


def test_grounding_ref_importable() -> None:
    from evals.fixtures.schema import GroundingRef  # noqa: F401


# ── STEP 3: GroundingRef field validation ─────────────────────────────────────


def test_grounding_ref_requires_doc_ref() -> None:
    from evals.fixtures.schema import GroundingRef

    with pytest.raises((ValidationError, TypeError)):
        GroundingRef()  # doc_ref required


def test_grounding_ref_section_and_line_range_are_optional() -> None:
    from evals.fixtures.schema import GroundingRef

    gr = GroundingRef(doc_ref="clinical_00_t2dm_diagnosis.txt")
    assert gr.section is None
    assert gr.line_range is None


def test_grounding_ref_with_section() -> None:
    from evals.fixtures.schema import GroundingRef

    gr = GroundingRef(
        doc_ref="denial_letter.txt",
        section="CLINICAL BASIS FOR DENIAL",
    )
    assert gr.section == "CLINICAL BASIS FOR DENIAL"
    assert gr.line_range is None


def test_grounding_ref_with_line_range() -> None:
    from evals.fixtures.schema import GroundingRef

    gr = GroundingRef(doc_ref="rx_snippet.txt", line_range="8-12")
    assert gr.line_range == "8-12"


def test_grounding_ref_round_trips_json() -> None:
    from evals.fixtures.schema import GroundingRef

    gr = GroundingRef(
        doc_ref="clinical_01_ppi_step_therapy.txt",
        section="Finding",
    )
    restored = GroundingRef.model_validate_json(gr.model_dump_json())
    assert restored.doc_ref == gr.doc_ref
    assert restored.section == gr.section


# ── STEP 3: ScenarioCriterion.grounding field ─────────────────────────────────


def test_scenario_criterion_accepts_grounding_field() -> None:
    from evals.fixtures.schema import GroundingRef, ScenarioCriterion

    crit = ScenarioCriterion(
        key="t2dm_diagnosis",
        label="Type II Diabetes Mellitus confirmed",
        rule_type="diagnostic",
        ground_truth_status="found",
        evidence_summary="HbA1c 8.2%",
        grounding=GroundingRef(
            doc_ref="clinical_00_t2dm_diagnosis.txt",
            section="Finding",
        ),
    )
    assert crit.grounding is not None
    assert crit.grounding.doc_ref == "clinical_00_t2dm_diagnosis.txt"
    assert crit.grounding.section == "Finding"


def test_scenario_criterion_grounding_is_optional() -> None:
    from evals.fixtures.schema import ScenarioCriterion

    crit = ScenarioCriterion(
        key="t2dm_diagnosis",
        label="Type II Diabetes Mellitus confirmed",
        rule_type="diagnostic",
        ground_truth_status="found",
        evidence_summary="HbA1c 8.2%",
        # no grounding field
    )
    assert crit.grounding is None


def test_existing_fixture_parses_with_grounding_field_added() -> None:
    """Backward compat: existing scenarios.json (no grounding keys) must still load."""
    from evals.fixtures.schema import load_scenarios_fixture

    fixture = load_scenarios_fixture()
    assert len(fixture.scenarios) >= 4


# ── STEP 4: EvalDimension import gate ─────────────────────────────────────────


def test_eval_dimension_importable() -> None:
    from evals.fixtures.schema import EvalDimension  # noqa: F401


# ── STEP 4: EvalDimension values match frontend rubric ────────────────────────


def test_eval_dimension_has_all_frontend_rubric_values() -> None:
    from evals.fixtures.schema import EvalDimension

    dimension_values = {d.value for d in EvalDimension}
    missing = _FRONTEND_RUBRIC_DIMENSIONS - dimension_values
    assert not missing, f"EvalDimension missing frontend rubric names: {missing}"


def test_eval_dimension_claim_citation_uses_snake_case() -> None:
    """Frontend uses 'claim-citation'; backend uses snake_case 'claim_citation'."""
    from evals.fixtures.schema import EvalDimension

    assert EvalDimension.claim_citation.value == "claim_citation"


def test_eval_dimension_over_caution_uses_snake_case() -> None:
    from evals.fixtures.schema import EvalDimension

    assert EvalDimension.over_caution.value == "over_caution"


# ── STEP 4: EvalScenario.eval_dimensions field ────────────────────────────────


def test_eval_scenario_accepts_eval_dimensions_field() -> None:
    from evals.fixtures.schema import EvalDimension, load_scenarios_fixture

    fixture = load_scenarios_fixture()
    for scenario in fixture.scenarios:
        dims = getattr(scenario, "eval_dimensions", [])
        # Any present values must be valid EvalDimension
        for d in dims:
            assert d in EvalDimension, f"Unknown eval_dimension: {d!r}"


def test_eval_scenario_eval_dimensions_defaults_to_empty() -> None:
    """When eval_dimensions is absent in the JSON, it should default to []."""
    from evals.fixtures.schema import load_scenarios_fixture

    fixture = load_scenarios_fixture()
    for scenario in fixture.scenarios:
        # Must have the attribute (even if [])
        assert hasattr(scenario, "eval_dimensions")


# ── STEP 3+4: doc_ref naming convention (grounding ties to generator output) ──


def test_grounding_doc_ref_naming_convention() -> None:
    """doc_ref for a criterion at index i must follow the generator's naming:
    clinical_<ii>_<key>.txt (as produced by golden_set.generate._generate_one)."""
    from evals.fixtures.schema import GroundingRef

    # Verify the pattern parses correctly (no validation rule yet, just smoke test)
    gr = GroundingRef(doc_ref="clinical_02_swallowing_limitation.txt", section="Status")
    assert gr.doc_ref.startswith("clinical_")
    assert gr.doc_ref.endswith(".txt")
