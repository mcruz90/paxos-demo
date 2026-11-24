"""Fixture binding and applicability rules shared by all labeled scenarios."""

import pytest
from fastapi import Request
from pydantic import ValidationError

from agents.nodes.determination import derive_determination
from api.assessment import assessment_reader
from evals.fixtures.schema import EvalScenario, load_scenarios_fixture
from evals.fixtures_adapter import (
    eval_scenario_to_appeal_request,
    eval_scenario_to_initial_pa_request,
    eval_scenario_to_scenario_config,
)
from main import app


def test_requests_share_the_reader_bound_at_app_construction():
    request = Request({"type": "http", "app": app})
    assert assessment_reader(request) is assessment_reader(request)


@pytest.mark.parametrize(
    "key,reason", [("ppi_step_therapy", "not_required"), ("absent", "unknown")]
)
def test_primary_argument_must_name_an_applicable_criterion(key, reason):
    scenario = next(
        s
        for s in load_scenarios_fixture().scenarios
        if s.scenario_id.endswith("pediatric_clinical_pa")
    )
    data = scenario.model_dump()
    data["expected_outcome"]["primary_argument_key"] = key
    with pytest.raises(ValidationError, match=rf"primary_argument_key.*{key}.*{reason}"):
        EvalScenario.model_validate(data)


@pytest.mark.parametrize(
    "scenario",
    [
        s
        for s in load_scenarios_fixture().scenarios
        if any(c.ground_truth_status == "not_required" for c in s.criteria)
    ],
    ids=lambda s: s.scenario_id,
)
def test_optional_criteria_do_not_trigger_information_requests(scenario):
    applicable = [c for c in scenario.criteria if c.ground_truth_status != "not_required"]
    # Product rules carry labels rather than fixture keys. Use each key as its
    # label in this copy so duplicate display labels cannot hide a leaked row.
    labeled = scenario.model_copy(
        update={"criteria": [c.model_copy(update={"label": c.key}) for c in scenario.criteria]}
    )
    initial = eval_scenario_to_initial_pa_request(labeled)
    for adapted in (
        initial,
        eval_scenario_to_appeal_request(labeled),
        eval_scenario_to_scenario_config(labeled),
    ):
        assert [row.rule.label for row in adapted.criteria_results] == [c.key for c in applicable]
    outcome = derive_determination(initial.criteria_results, 0, "synthetic")
    statuses = {c.ground_truth_status for c in applicable}
    legitimate_pend = "conflict" not in statuses and (not statuses or "needs_review" in statuses)
    assert (outcome.decision == "pended") == legitimate_pend
