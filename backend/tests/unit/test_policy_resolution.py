"""Regression for policy borrowing through the resolver and its runtime callers."""

from __future__ import annotations

from datetime import date

from agents.generate import run_pipeline
from agents.nodes.crd_check import run_crd_check
from agents.nodes.ingestion import run_ingestion
from agents.nodes.pa_ingestion import run_pa_ingestion
from agents.nodes.retrieval import run_retrieval
from agents.requirements_lookup import resolve_requirements
from models.schemas import AppealRequest, ErrorEvent, InitialPaRequest, StepEvent

_PLAN = "CIGNA-CNF360-2024"
_KNOWN_DRUG = "Ozempic (semaglutide)"
_UNRELATED_DRUG = "Synthetic unrelated product"
_DIAGNOSIS = "Type 2 Diabetes Mellitus"


def test_exact_plan_does_not_borrow_requirements_for_wrong_drug() -> None:
    known, _ = resolve_requirements(_PLAN, _KNOWN_DRUG)
    unrelated, _ = resolve_requirements(_PLAN, _UNRELATED_DRUG)
    assert known != unrelated

    criteria, resolution = resolve_requirements(
        _PLAN, _KNOWN_DRUG, diagnosis=_DIAGNOSIS, as_of=date(2026, 11, 19)
    )
    assert resolution == "plan_id"
    assert "Cigna" in criteria


def _unrelated_appeal() -> AppealRequest:
    return AppealRequest(
        scenario_id="synthetic-wrong-product",
        drug=_UNRELATED_DRUG,
        diagnosis=_DIAGNOSIS,
        denial_text="Synthetic denial.",
        denial_reason="Synthetic reason.",
        plan="Synthetic plan display name",
        plan_id=_PLAN,
        criteria_results=[],
    )


def test_appeal_retrieval_keeps_patient_input_and_discards_incompatible_policy() -> None:
    request = _unrelated_appeal()
    state = run_retrieval(run_ingestion(request))
    assert state["pa_resolution"] == "generic"
    assert state["pa_context"] == ""
    assert state["request"] == request


def test_initial_pa_holds_on_exact_plan_with_wrong_drug() -> None:
    request = InitialPaRequest(
        scenario_id="synthetic-wrong-product",
        drug=_UNRELATED_DRUG,
        diagnosis=_DIAGNOSIS,
        plan="Synthetic plan display name",
        plan_id=_PLAN,
        requested_therapy=_UNRELATED_DRUG,
        criteria_results=[],
    )
    state = run_crd_check(run_pa_ingestion(request))
    verdict = state["pa_required"]
    assert verdict is not None
    assert verdict.required is None
    assert "product_mismatch" in verdict.basis
    assert "Confirm" in verdict.basis
    assert state["pa_context"] == ""


async def test_policy_hold_terminates_appeal_before_synthesis() -> None:
    events = [event async for event in run_pipeline(_unrelated_appeal(), llm_backend=object())]
    assert all(not (isinstance(event, StepEvent) and event.step == "synthesis") for event in events)
    terminal = events[-1]
    assert isinstance(terminal, ErrorEvent)
    assert "product_mismatch" in terminal.message
    assert "Confirm" in terminal.message
