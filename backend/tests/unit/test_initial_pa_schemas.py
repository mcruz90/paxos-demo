"""Unit tests — Sprint 2 Slice 1: lifecycle-named initial-PA schemas (spec-first).

The initial-PA lifecycle gets its own request/event contract. AppealRequest
stays appeal-shaped — an initial PA has no denial to quote, and Slice 4's
idempotency key derives from the case reference, so the shapes must not be
conflated (11-sprint-plan.md, Sprint 2 standing rules).
"""

from __future__ import annotations

import typing

import pytest
from pydantic import ValidationError

from models.schemas import (
    AppealHandoff,
    AppealRequest,
    ChunkEvent,
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaEvent,
    InitialPaRequest,
    PaDecision,
    PaOutcome,
    PaRequired,
    StepEvent,
)


def _valid_request_kwargs() -> dict:
    return {
        "scenario_id": "novo-ozempic-initial",
        "case_ref": "PA-2026-0847",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Commercial",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic 0.5 mg subcutaneous weekly",
        "criteria_results": [],
    }


# ---------------------------------------------------------------------------
# PaDecision enum
# ---------------------------------------------------------------------------


def test_pa_decision_values() -> None:
    assert {member.value for member in PaDecision} == {"approved", "pended", "denied"}


def test_pa_outcome_decision_is_pa_decision() -> None:
    """PaOutcome.decision is the PaDecision enum, not a loose string — Slice 3
    determination handling branches on it."""
    outcome = PaOutcome.model_validate(
        {
            "decision": "denied",
            "determinationId": "DET-001",
            "timeToTherapy": "—",
            "note": "Step therapy not satisfied.",
        }
    )
    assert outcome.decision is PaDecision.denied


# ---------------------------------------------------------------------------
# InitialPaRequest
# ---------------------------------------------------------------------------


def test_initial_pa_request_is_not_an_appeal_request() -> None:
    """Standing rule: do NOT extend AppealRequest — the initial-PA request is
    its own lifecycle-named schema."""
    assert not issubclass(InitialPaRequest, AppealRequest)


def test_initial_pa_request_has_no_denial_fields() -> None:
    """An initial PA precedes any payer decision — a denial_text field on the
    request would conflate the two lifecycles."""
    assert "denial_text" not in InitialPaRequest.model_fields
    assert "denial_reason" not in InitialPaRequest.model_fields


def test_initial_pa_request_valid_and_defaults() -> None:
    req = InitialPaRequest(**_valid_request_kwargs())
    assert req.security_hold is False
    assert req.security_reason == ""


def test_initial_pa_request_case_ref_optional() -> None:
    kwargs = _valid_request_kwargs()
    del kwargs["case_ref"]
    assert InitialPaRequest(**kwargs).case_ref == ""


def test_initial_pa_request_strict_rejects_type_coercion() -> None:
    kwargs = _valid_request_kwargs()
    kwargs["drug"] = 123
    with pytest.raises(ValidationError):
        InitialPaRequest(**kwargs)


def test_initial_pa_request_rejects_bad_scenario_id() -> None:
    kwargs = _valid_request_kwargs()
    kwargs["scenario_id"] = "Bad_ID!"
    with pytest.raises(ValidationError):
        InitialPaRequest(**kwargs)


def test_initial_pa_request_rejects_overlong_case_ref() -> None:
    kwargs = _valid_request_kwargs()
    kwargs["case_ref"] = "X" * 65
    with pytest.raises(ValidationError):
        InitialPaRequest(**kwargs)


def test_initial_pa_request_carries_security_hold_pair() -> None:
    """The ETL's security_hold detection flag must be representable on the
    initial-PA request so the pipeline gate (its enforcement point) carries
    over to this lifecycle."""
    kwargs = _valid_request_kwargs()
    kwargs["security_hold"] = True
    kwargs["security_reason"] = "injection pattern detected"
    req = InitialPaRequest(**kwargs)
    assert req.security_hold is True


# ---------------------------------------------------------------------------
# InitialPaDoneEvent / InitialPaEvent union
# ---------------------------------------------------------------------------


def test_initial_pa_done_event_shape_and_defaults() -> None:
    done = InitialPaDoneEvent(pa_required=PaRequired(required=True, basis="Formulary tier 3"))
    assert done.event == "done"
    assert done.outcome is None
    assert done.appeal_handoff is None
    assert done.submission_ref == ""
    assert done.pa_resolution == ""


def test_initial_pa_done_event_denied_carries_handoff() -> None:
    done = InitialPaDoneEvent(
        pa_required=PaRequired(required=True, basis="Formulary tier 3"),
        outcome=PaOutcome(
            decision=PaDecision.denied,
            determinationId="DET-002",
            timeToTherapy="—",
            note="Denied — step therapy.",
        ),
        appeal_handoff=AppealHandoff(scenarioId="novo-ozempic-denied", caseRef="PA-2026-0847"),
        submission_ref="PAS-0001",
    )
    assert done.outcome is not None and done.outcome.decision is PaDecision.denied
    assert done.appeal_handoff is not None and done.appeal_handoff.case_ref == "PA-2026-0847"


def test_initial_pa_event_union_members() -> None:
    """The initial-PA stream shares step/done/error with the appeal contract
    but never streams chunks — there is no LLM in the initial-PA path (the
    denied→appeal handoff is a pointer; launching the appeal stays
    human-gated)."""
    members = set(typing.get_args(InitialPaEvent))
    assert members == {StepEvent, InitialPaDoneEvent, ErrorEvent}
    assert ChunkEvent not in members
