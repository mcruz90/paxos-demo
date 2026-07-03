"""Unit tests — etl/pas_rail (S2 Slice 3).

Adapter pattern, outbound: canonical PaSubmission in, PAS/X12-278-shaped rail
request out. Rail-accurate per 05-state-lifecycle.md — the PAS rail carries
initial PAs only; appeals ride the appeal channel and never touch this
module. The stub submit() must be deterministic (same submission → same
submission_ref) — Slice 4's idempotency key builds on it.
"""

from __future__ import annotations

from etl.pas_rail.adapter import PasRailRequest, submit_to_pas_rail, to_pas_request
from models.schemas import (
    CriterionResult,
    CriterionStatus,
    PaSubmission,
    Rule,
    RuleType,
)


def _submission() -> PaSubmission:
    return PaSubmission(
        case_ref="PA-2026-0847",
        scenario_id="novo-ozempic-initial",
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        plan_id="CIGNA-CNF360-2024",
        requested_therapy="Ozempic 0.5 mg subcutaneous weekly",
        criteria_evidence=[
            CriterionResult(
                rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
                status=CriterionStatus.found,
                note="E11.9 documented",
            )
        ],
        pa_context="Cigna criteria: A1c ≥ 7.0 despite metformin.",
    )


def test_to_pas_request_is_x12_278_shaped() -> None:
    rail_request = to_pas_request(_submission())
    assert isinstance(rail_request, PasRailRequest)
    assert rail_request.transaction_set == "278"
    assert rail_request.trace_number  # non-empty — the X12 BHT03-style trace
    assert rail_request.plan_id == "CIGNA-CNF360-2024"
    assert rail_request.requested_therapy == "Ozempic 0.5 mg subcutaneous weekly"


def test_to_pas_request_trace_is_deterministic() -> None:
    """Same canonical submission → same trace number (retried assemblies must
    not mint new rail identities)."""
    assert to_pas_request(_submission()).trace_number == to_pas_request(_submission()).trace_number


def test_submit_returns_deterministic_submission_ref() -> None:
    """Stub rail: same rail request → same submission_ref. A retried request
    must never look like a second submission (CLAUDE.md idempotency —
    enforced end-to-end in Slice 4)."""
    rail_request = to_pas_request(_submission())
    ref_a = submit_to_pas_rail(rail_request)
    ref_b = submit_to_pas_rail(rail_request)
    assert ref_a == ref_b
    assert ref_a.startswith("PAS-")


def test_submission_ref_differs_per_case() -> None:
    other = _submission().model_copy(update={"case_ref": "PA-2026-0999"})
    ref_a = submit_to_pas_rail(to_pas_request(_submission()))
    ref_b = submit_to_pas_rail(to_pas_request(other))
    assert ref_a != ref_b
