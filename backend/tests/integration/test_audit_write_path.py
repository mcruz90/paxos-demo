"""Integration tests — AuditRecord write path at both pipeline boundaries (S2 Slice 4).

Every run — appeal or initial-PA, done or error, including security holds —
writes exactly one AuditRecord with correlation_id + provenance, BEFORE the
terminal event is emitted. Retried requests (same case + attempt) never
double-write; a deliberate resubmission (attempt bumped) writes a new entry.
"""

from __future__ import annotations

from typing import Any

import pytest

from agents.generate import run_pipeline
from agents.initial_pa_graph import run_initial_pa_pipeline
from audit.store import all_records, reset_audit_log
from models.schemas import (
    AppealRequest,
    AuditProvenance,
    CaseLifecycle,
    CaseTier,
    CriterionResult,
    CriterionStatus,
    DoneEvent,
    ErrorEvent,
    InitialPaDoneEvent,
    InitialPaRequest,
    Rule,
    RuleType,
)
from tests.conftest import MockLLMBackend


@pytest.fixture(autouse=True)
def _clean_audit_log():
    reset_audit_log()
    yield
    reset_audit_log()


def _initial_pa_request(**overrides: Any) -> InitialPaRequest:
    kwargs: dict[str, Any] = {
        "scenario_id": "novo-ozempic-initial",
        "case_ref": "PA-2026-0847",
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "requested_therapy": "Ozempic 0.5 mg subcutaneous weekly",
        "criteria_results": [
            CriterionResult(
                rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus"),
                status=CriterionStatus.found,
                note="E11.9 documented",
            )
        ],
    }
    kwargs.update(overrides)
    return InitialPaRequest(**kwargs)


async def _run_appeal(request: AppealRequest) -> list:
    return [e async for e in run_pipeline(request, llm_backend=MockLLMBackend())]


async def _run_initial_pa(request: InitialPaRequest) -> list:
    return [e async for e in run_initial_pa_pipeline(request)]


# ---------------------------------------------------------------------------
# Appeal lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_appeal_done_run_writes_exactly_one_record(base_appeal_request) -> None:
    events = await _run_appeal(base_appeal_request)
    records = all_records()
    assert len(records) == 1

    record = records[0]
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert record.lifecycle is CaseLifecycle.appeal
    assert record.outcome == "done"
    assert record.provenance is AuditProvenance.as_is
    assert record.gatekeeper_passed is True
    assert record.artifact_ref == done.ref
    assert record.pa_resolution == done.pa_resolution
    assert record.correlation_id
    assert record.correlation_id == done.correlation_id
    # S3 Slice 3: the deterministic HITL tier is recorded on the audit entry
    # (the golden Ozempic request routes to complex) and matches the DoneEvent.
    assert record.tier == CaseTier.complex
    assert record.tier == done.tier


@pytest.mark.asyncio
async def test_appeal_transport_retry_does_not_double_write(base_appeal_request) -> None:
    """Same case + same attempt run twice (client timeout / SSE reconnect) —
    the second run maps onto the same idempotency key and must not append a
    second record."""
    await _run_appeal(base_appeal_request)
    await _run_appeal(base_appeal_request)
    assert len(all_records()) == 1


@pytest.mark.asyncio
async def test_appeal_deliberate_resubmission_writes_new_record(base_appeal_request) -> None:
    await _run_appeal(base_appeal_request)
    resubmission = base_appeal_request.model_copy(update={"attempt": 2})
    await _run_appeal(resubmission)

    records = all_records()
    assert len(records) == 2
    assert records[0].idempotency_key != records[1].idempotency_key


@pytest.mark.asyncio
async def test_appeal_error_run_writes_record(base_appeal_request) -> None:
    class AlwaysFailBackend:
        model_name = "always-fail"

        async def generate_stream(self, prompt):
            yield "I cannot assist with this request."

        async def generate(self, prompt):
            return "I cannot assist with this request."

    events = [
        e async for e in run_pipeline(base_appeal_request, llm_backend=AlwaysFailBackend())
    ]
    records = all_records()
    assert len(records) == 1
    assert records[0].outcome == "error"
    assert records[0].retry_count == 3
    # The exhausted path produced no letter, so there is no artifact to route
    # to a review surface — tier stays None on an error run (S3 Slice 3).
    assert records[0].tier is None
    error = next(e for e in events if isinstance(e, ErrorEvent))
    assert error.correlation_id == records[0].correlation_id


@pytest.mark.asyncio
async def test_security_hold_run_is_audited(base_appeal_request) -> None:
    """A blocked document is an accountability event — the hold itself must
    leave an audit trail."""
    held = base_appeal_request.model_copy(
        update={"security_hold": True, "security_reason": "injection pattern detected"}
    )
    await _run_appeal(held)
    records = all_records()
    assert len(records) == 1
    assert records[0].outcome == "error"


@pytest.mark.asyncio
async def test_record_written_before_terminal_event_is_yielded(base_appeal_request) -> None:
    """ACID §Durability: the record must be persisted before the terminal
    event reaches the client."""
    async for event in run_pipeline(base_appeal_request, llm_backend=MockLLMBackend()):
        if isinstance(event, DoneEvent):
            assert len(all_records()) == 1


# ---------------------------------------------------------------------------
# Initial-PA lifecycle
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_initial_pa_done_run_writes_record_with_submission_ref() -> None:
    events = await _run_initial_pa(_initial_pa_request())
    records = all_records()
    assert len(records) == 1

    record = records[0]
    done = next(e for e in events if isinstance(e, InitialPaDoneEvent))
    assert record.lifecycle is CaseLifecycle.initial_pa
    assert record.case_ref == "PA-2026-0847"
    assert record.outcome == "done"
    assert record.model_name == ""  # no LLM in this path
    assert record.artifact_ref == done.submission_ref
    assert record.pa_resolution == done.pa_resolution
    assert record.correlation_id == done.correlation_id
    assert record.correlation_id.startswith("PA-2026-0847:a")


@pytest.mark.asyncio
async def test_initial_pa_transport_retry_does_not_double_write() -> None:
    await _run_initial_pa(_initial_pa_request())
    await _run_initial_pa(_initial_pa_request())
    assert len(all_records()) == 1


@pytest.mark.asyncio
async def test_initial_pa_and_appeal_records_are_distinct(base_appeal_request) -> None:
    """One case flowing through both lifecycles yields two audit entries with
    distinct idempotency keys (different lifecycles, different runs)."""
    await _run_initial_pa(_initial_pa_request())
    await _run_appeal(base_appeal_request)
    assert len(all_records()) == 2


@pytest.mark.asyncio
async def test_done_event_carries_retry_count(base_appeal_request) -> None:
    """DoneEvent now reports how many gatekeeper retries preceded the pass —
    the audit record and reviewers need 'passed after N retries', which was
    previously only visible on errors."""
    events = await _run_appeal(base_appeal_request)
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert done.retry_count == 0
