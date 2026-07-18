"""Integration tests — resume a parked exception-tier run (S3 Slice 4b).

``POST /api/appeal/resume`` drives a human-reviewed exception run from its
parked checkpoint (S3 Slice 4a) to a ``done`` terminal, and writes a DISTINCT
audit entry: same ``correlation_id`` (the saga traces under one ID) but a
distinct ``idempotency_key`` (``<corr>:resume``), so the accountability trail
keeps BOTH the machine draft (``as_is``) and the human sign-off —
``human_approved`` when the draft was cleared unchanged, ``human_edited``
when the text actually changed (CLAUDE.md §AI Output Accountability;
May's honesty ruling 2026-07-18).

Run from backend/:
    uv run pytest tests/integration/test_resume.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from agents.generate import run_pipeline
from agents.graph import _PIPELINE
from agents.resume import run_resume
from audit.store import all_records, reset_audit_log
from models.schemas import (
    AppealRequest,
    AuditProvenance,
    CaseTier,
    CriterionResult,
    CriterionStatus,
    DoneEvent,
    Rule,
    RuleType,
)
from tests.conftest import MockLLMBackend


@pytest.fixture(autouse=True)
def _clean_audit_log():
    reset_audit_log()
    yield
    reset_audit_log()


def _criterion(confidence: float | None) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus confirmed"),
        status=CriterionStatus.needs_review,
        note="",
        confidence=confidence,
    )


def _exception_request(scenario_id: str) -> AppealRequest:
    return AppealRequest(
        scenario_id=scenario_id,
        drug="Ozempic (semaglutide)",
        diagnosis="Type 2 Diabetes Mellitus",
        denial_text="Denied.",
        denial_reason="step therapy",
        plan="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        criteria_results=[_criterion(0.98), _criterion(0.50)],
    )


async def _park(scenario_id: str) -> tuple[str, DoneEvent]:
    """Run an exception request through the pipeline (parks it at hold) and
    return its correlation_id + the draft DoneEvent."""
    events = [
        e async for e in run_pipeline(_exception_request(scenario_id), llm_backend=MockLLMBackend())
    ]
    done = next(e for e in events if isinstance(e, DoneEvent))
    return done.correlation_id, done


# ---------------------------------------------------------------------------
# run_resume driver
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resume_emits_done_and_reaches_clean_end() -> None:
    corr, _ = await _park("resume-emits-done")
    events = [e async for e in run_resume(corr, edited_text=None)]

    assert [e.event for e in events].count("error") == 0
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert done.tier == CaseTier.exception
    assert done.correlation_id == corr
    # The parked run resumed to a clean end.
    assert _PIPELINE.get_state({"configurable": {"thread_id": corr}}).next == ()


@pytest.mark.asyncio
async def test_resume_as_is_writes_distinct_human_approved_record() -> None:
    corr, _ = await _park("resume-audit")
    assert len(all_records()) == 1
    assert all_records()[0].provenance is AuditProvenance.as_is  # the machine draft

    [e async for e in run_resume(corr, edited_text=None)]

    records = all_records()
    assert len(records) == 2, "resume must append its own record, not dedup against the draft"
    resume_rec = records[1]
    # Approved unchanged: a human decision, not an edit (May's ruling 2026-07-18).
    assert resume_rec.provenance is AuditProvenance.human_approved
    assert resume_rec.correlation_id == corr  # same saga, end-to-end traceable
    assert resume_rec.idempotency_key == f"{corr}:resume"  # distinct write
    assert records[0].idempotency_key != resume_rec.idempotency_key


@pytest.mark.asyncio
async def test_resume_with_changed_text_writes_human_edited_record() -> None:
    corr, _ = await _park("resume-audit-edited")
    [e async for e in run_resume(corr, edited_text="Materially revised letter body.")]

    records = all_records()
    assert len(records) == 2
    assert records[1].provenance is AuditProvenance.human_edited


@pytest.mark.asyncio
async def test_resume_applies_human_edited_text() -> None:
    corr, draft = await _park("resume-edit")
    edited = (
        "Dear Medical Director, on human review the appeal body was revised to "
        "materially different, clinically accurate language before submission. "
    ) * 4
    events = [e async for e in run_resume(corr, edited_text=edited)]
    done = next(e for e in events if isinstance(e, DoneEvent))
    assert done.ref != draft.ref, "the outbound artifact hash must reflect the human edit"


@pytest.mark.asyncio
async def test_resume_unknown_run_errors_without_audit() -> None:
    events = [e async for e in run_resume("never-parked:a1", edited_text=None)]
    assert events[-1].event == "error"
    assert len(all_records()) == 0, "a resume of a non-existent run is not an auditable pipeline run"


@pytest.mark.asyncio
async def test_resume_twice_is_idempotent() -> None:
    corr, _ = await _park("resume-twice")
    [e async for e in run_resume(corr, edited_text=None)]
    second = [e async for e in run_resume(corr, edited_text=None)]

    assert second[-1].event == "error", "a completed run cannot be resumed again"
    assert len(all_records()) == 2, "draft + one resume record; no double-write"


# ---------------------------------------------------------------------------
# POST /api/appeal/resume endpoint
# ---------------------------------------------------------------------------


@pytest.fixture
def client(monkeypatch) -> TestClient:
    monkeypatch.setenv("API_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("LLM_BACKEND", "mock")
    from main import app

    return TestClient(app, raise_server_exceptions=False)


def _auth_headers() -> dict:
    return {"Authorization": "Bearer test-secret-key"}


def _exception_payload(scenario_id: str) -> dict:
    return {
        "scenario_id": scenario_id,
        "drug": "Ozempic (semaglutide)",
        "diagnosis": "Type 2 Diabetes Mellitus",
        "denial_text": "Authorization denied.",
        "denial_reason": "step therapy",
        "plan": "Cigna Connect 500 PPO",
        "plan_id": "CIGNA-CNF360-2024",
        "criteria_results": [],
    }


def _parse_sse_events(body: str) -> list[dict]:
    import json

    events, current = [], {}
    for line in body.splitlines():
        if line.startswith("event:"):
            current["event"] = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            current["data"] = json.loads(line.split(":", 1)[1].strip())
        elif line == "" and current:
            events.append(current)
            current = {}
    return events


def test_resume_requires_auth(client: TestClient) -> None:
    resp = client.post("/api/appeal/resume", json={"correlation_id": "x:a1"})
    assert resp.status_code == 401


def test_resume_endpoint_streams_done_terminal(client: TestClient) -> None:
    # Park an exception run through the generate endpoint (empty criteria →
    # exception tier), then resume it.
    with client.stream(
        "POST",
        "/api/appeal/generate",
        json=_exception_payload("resume-endpoint-e2e"),
        headers=_auth_headers(),
    ) as resp:
        draft_body = resp.read().decode()
    draft_done = next(e for e in _parse_sse_events(draft_body) if e["event"] == "done")
    corr = draft_done["data"]["correlation_id"]
    assert draft_done["data"]["tier"] == "exception"

    with client.stream(
        "POST",
        "/api/appeal/resume",
        json={"correlation_id": corr},
        headers=_auth_headers(),
    ) as resp:
        resume_body = resp.read().decode()
    resume_events = _parse_sse_events(resume_body)
    assert any(e["event"] == "done" for e in resume_events)
    assert all(e["event"] != "error" for e in resume_events)
