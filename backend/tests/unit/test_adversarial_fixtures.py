"""RED tests for Steps 5-6 — adversarial/red-team fixtures, ICD-10 fix,
grounding refs in relabeled scenarios, and eval-dimension annotations.

Exercises:
  Step 5: redteam scenarios (prompt injection, PHI leakage) in scenarios.json;
          test that the labeled input texts actually trigger the existing defenses
  Step 6: Livdelzi ICD-10 K83.01 → K74.3 correction in seeds.py + scenarios.json;
          grounding refs on clinical_pa criteria; eval_dimensions on all scenarios

Run from backend/:
    uv run pytest tests/unit/test_adversarial_fixtures.py -v
"""
from __future__ import annotations

import pytest

from evals.fixtures.schema import EvalDimension, load_scenarios_fixture

_REDTEAM_SCENARIO_IDS = {
    "ozempic_cigna_injection_redteam",
    "esomeprazole_phi_leakage_redteam",
}

_CLINICAL_PA_IDS = {
    "ozempic_cigna_clinical_pa",
    "esomeprazole_uhc_pediatric_clinical_pa",
    "livdelzi_cigna_hepatology_clinical_pa",
}

# ── STEP 6: ICD-10 fix — K83.01 (PSC) → K74.3 (PBC) ─────────────────────────


def test_livdelzi_icd10_in_seeds_is_k74_3() -> None:
    """PBC (Primary Biliary Cholangitis) is K74.3; K83.01 is PSC — a different disease."""
    from golden_set.seeds import SEEDS

    seed = SEEDS["livdelzi_cigna_hepatology"]
    assert seed.icd_code == "K74.3", (
        f"Livdelzi icd_code is {seed.icd_code!r}; must be K74.3 (PBC). "
        "K83.01 is Primary Sclerosing Cholangitis, not PBC."
    )


def test_livdelzi_icd10_in_fixture_is_k74_3() -> None:
    """scenarios.json submitted_codes.icd10 must reflect the corrected K74.3."""
    fixture = load_scenarios_fixture()
    livdelzi = next(
        s for s in fixture.scenarios if s.scenario_id == "livdelzi_cigna_hepatology_clinical_pa"
    )
    assert "K74.3" in livdelzi.submitted_codes.icd10, (
        f"submitted_codes.icd10={livdelzi.submitted_codes.icd10!r}; "
        "K74.3 (PBC) must be present, not K83.01 (PSC)"
    )
    assert "K83.01" not in livdelzi.submitted_codes.icd10, (
        "K83.01 (PSC) must be removed — PBC is K74.3"
    )


def test_livdelzi_policy_expected_codes_uses_k74_3() -> None:
    """source_text must lead with K74.3 (PBC). Referencing K83.01 as a counter-example
    is informative and acceptable; what matters is K74.3 is present."""
    fixture = load_scenarios_fixture()
    livdelzi = next(
        s for s in fixture.scenarios if s.scenario_id == "livdelzi_cigna_hepatology_clinical_pa"
    )
    assert "K74.3" in livdelzi.policy_expected_codes.source_text


# ── STEP 5: Adversarial scenario presence ────────────────────────────────────


def test_redteam_scenarios_present_in_fixture() -> None:
    """Both adversarial scenarios must be present in scenarios.json."""
    fixture = load_scenarios_fixture()
    found_ids = {s.scenario_id for s in fixture.scenarios}
    missing = _REDTEAM_SCENARIO_IDS - found_ids
    assert not missing, f"Missing redteam scenario IDs: {missing}"


def test_redteam_scenarios_have_correct_denial_type() -> None:
    fixture = load_scenarios_fixture()
    for scenario_id in _REDTEAM_SCENARIO_IDS:
        scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
        assert scenario.denial_type == "redteam", (
            f"{scenario_id}: denial_type={scenario.denial_type!r}; expected 'redteam'"
        )


# ── STEP 5: Injection scenario ────────────────────────────────────────────────


def test_injection_scenario_expects_security_hold() -> None:
    fixture = load_scenarios_fixture()
    injection = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_injection_redteam"
    )
    assert injection.expected_outcome.expected_security_hold is True


def test_injection_scenario_has_input_text() -> None:
    fixture = load_scenarios_fixture()
    injection = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_injection_redteam"
    )
    assert injection.redteam_input_text is not None
    assert len(injection.redteam_input_text) > 0


def test_injection_input_text_triggers_sanitize() -> None:
    """The labeled injection text must be flagged by the existing sanitize defense."""
    from security.sanitize import sanitize_extracted_text

    fixture = load_scenarios_fixture()
    injection = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_injection_redteam"
    )
    result = sanitize_extracted_text(injection.redteam_input_text or "")
    assert result.suspicious is True, (
        "Injection scenario input_text must be detected as suspicious by sanitize_extracted_text"
    )


def test_injection_scenario_resolution_path_is_security_hold() -> None:
    fixture = load_scenarios_fixture()
    injection = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_injection_redteam"
    )
    assert injection.expected_outcome.resolution_path == "security_hold"


# ── STEP 5: PHI leakage scenario ─────────────────────────────────────────────


def test_phi_leakage_scenario_has_input_text() -> None:
    fixture = load_scenarios_fixture()
    phi_leak = next(
        s for s in fixture.scenarios if s.scenario_id == "esomeprazole_phi_leakage_redteam"
    )
    assert phi_leak.redteam_input_text is not None
    assert len(phi_leak.redteam_input_text) > 0


def test_phi_leakage_scenario_expects_phi_redacted() -> None:
    fixture = load_scenarios_fixture()
    phi_leak = next(
        s for s in fixture.scenarios if s.scenario_id == "esomeprazole_phi_leakage_redteam"
    )
    assert phi_leak.expected_outcome.expected_defensive_behavior == "phi_redacted"


def test_phi_leakage_input_triggers_redact() -> None:
    """The labeled PHI leakage input must have its PHI patterns scrubbed by redact_phi."""
    from security.redact import redact_phi

    fixture = load_scenarios_fixture()
    phi_leak = next(
        s for s in fixture.scenarios if s.scenario_id == "esomeprazole_phi_leakage_redteam"
    )
    raw = phi_leak.redteam_input_text or ""
    redacted = redact_phi(raw)

    # The scenario must contain at least one PHI-like pattern to be a meaningful test
    assert raw != redacted, (
        "PHI leakage scenario input_text must contain PHI patterns detectable by redact_phi"
    )


# ── STEP 6: Grounding refs on clinical_pa criteria ────────────────────────────


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_criteria_have_grounding(scenario_id: str) -> None:
    """Every criterion in clinical_pa scenarios must have a grounding ref after relabeling."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    for crit in scenario.criteria:
        assert crit.grounding is not None, (
            f"{scenario_id} criterion {crit.key!r}: grounding is None after relabeling"
        )
        assert crit.grounding.doc_ref, (
            f"{scenario_id} criterion {crit.key!r}: grounding.doc_ref is empty"
        )


@pytest.mark.parametrize("scenario_id", sorted(_CLINICAL_PA_IDS))
def test_clinical_pa_grounding_doc_refs_follow_naming_convention(scenario_id: str) -> None:
    """doc_ref must point to a file producible by the golden-set generator."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    valid_prefixes = ("clinical_", "denial_letter", "rx_snippet")
    for crit in scenario.criteria:
        if crit.grounding:
            ref = crit.grounding.doc_ref
            assert any(ref.startswith(p) for p in valid_prefixes), (
                f"{scenario_id} criterion {crit.key!r}: "
                f"doc_ref={ref!r} does not match naming convention"
            )


# ── STEP 6: Eval-dimension annotations on all scenarios ───────────────────────


_ALL_SCENARIO_IDS = _CLINICAL_PA_IDS | {"ozempic_cigna_coding_error"}


@pytest.mark.parametrize("scenario_id", sorted(_ALL_SCENARIO_IDS))
def test_scenario_has_eval_dimensions(scenario_id: str) -> None:
    """Every non-redteam scenario must declare at least one eval dimension after relabeling."""
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    assert scenario.eval_dimensions, (
        f"{scenario_id}: eval_dimensions is empty — must declare ≥1 dimension"
    )


@pytest.mark.parametrize("scenario_id", sorted(_ALL_SCENARIO_IDS))
def test_scenario_eval_dimensions_are_valid(scenario_id: str) -> None:
    fixture = load_scenarios_fixture()
    scenario = next(s for s in fixture.scenarios if s.scenario_id == scenario_id)
    for dim in scenario.eval_dimensions:
        assert dim in EvalDimension, f"{scenario_id}: unknown dimension {dim!r}"


def test_livdelzi_exercises_claim_citation_dimension() -> None:
    """Livdelzi UDCA-trial criterion is the primary faithfulness test case."""
    fixture = load_scenarios_fixture()
    livdelzi = next(
        s for s in fixture.scenarios if s.scenario_id == "livdelzi_cigna_hepatology_clinical_pa"
    )
    assert EvalDimension.claim_citation in livdelzi.eval_dimensions


def test_ozempic_exercises_safety_dimension() -> None:
    """Ozempic no-concurrent-GLP1 criterion exercises the safety dimension."""
    fixture = load_scenarios_fixture()
    ozempic = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_clinical_pa"
    )
    assert EvalDimension.safety in ozempic.eval_dimensions


def test_coding_error_exercises_coverage_dimension() -> None:
    """The coding-error scenario primarily exercises coverage (policy citation) detection."""
    fixture = load_scenarios_fixture()
    coding = next(
        s for s in fixture.scenarios if s.scenario_id == "ozempic_cigna_coding_error"
    )
    assert EvalDimension.coverage in coding.eval_dimensions
