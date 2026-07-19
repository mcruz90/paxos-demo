"""tools/smoke_tour.py — end-to-end smoke tour of the PaxOS backend (S3 Task 3).

A hand-driven, no-network walkthrough that boots the pipelines with the mock
LLM backend and drives one scenario down each path, printing the event
timeline, the assigned tier, and the resulting audit trail. It exists so a
human can *watch* the HITL machinery work in one run:

    routine  → complex  → exception (park → list-pending → resume)  → pa/submit

This is a developer tool, NOT part of the app. It is deliberately not imported
by any package under ``backend/`` (it reaches into app modules; nothing reaches
back). It talks to the pipeline entrypoints directly rather than over HTTP —
the auth middleware and SSE framing are the endpoints' concern and are covered
by the integration suite; this tour is about the *behavior* underneath.

Run from backend/:
    uv run python tools/smoke_tour.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# This script lives in backend/tools/; put backend/ on the path so it can be
# launched as `python tools/smoke_tour.py` from the backend dir.
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Boot with the mock backend — no API key, no network (README quick start).
os.environ.setdefault("LLM_BACKEND", "mock")

# The tour prints Unicode glyphs; force UTF-8 so it renders on a cp1252 console
# (Windows) instead of raising UnicodeEncodeError.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]

from agents.generate import run_pipeline  # noqa: E402
from agents.initial_pa_graph import run_initial_pa_pipeline  # noqa: E402
from agents.resume import run_resume  # noqa: E402
from agents.review_queue import derive_pending_reviews, is_run_parked  # noqa: E402
from audit.store import all_records, reset_audit_log  # noqa: E402
from ml.mock_backend import MockLLMBackend  # noqa: E402
from models.schemas import (  # noqa: E402
    AppealRequest,
    CriterionResult,
    CriterionStatus,
    DoneEvent,
    InitialPaRequest,
    Rule,
    RuleType,
)
from security.tenancy import TenancyScope  # noqa: E402

# A real Cigna pack (resolves via plan_id → pa_resolution="plan_id", so tier is
# driven by criteria confidence, not a generic-fallback exception signal).
_PLAN = "Cigna Connect 500 PPO"
_PLAN_ID = "CIGNA-CNF360-2024"
_DRUG = "Ozempic (semaglutide)"
_DIAGNOSIS = "Type 2 Diabetes Mellitus"


def _criterion(confidence: float | None) -> CriterionResult:
    return CriterionResult(
        rule=Rule(type=RuleType.diagnostic, label="Type 2 Diabetes Mellitus confirmed"),
        status=CriterionStatus.found,
        note="",
        confidence=confidence,
    )


def _request(scenario_id: str, criteria: list[CriterionResult]) -> AppealRequest:
    return AppealRequest(
        scenario_id=scenario_id,
        drug=_DRUG,
        diagnosis=_DIAGNOSIS,
        denial_text="Authorization denied — step therapy required.",
        denial_reason="step therapy",
        plan=_PLAN,
        plan_id=_PLAN_ID,
        criteria_results=criteria,
    )


def _banner(title: str) -> None:
    print(f"\n{'=' * 68}\n  {title}\n{'=' * 68}")


def _print_timeline(events: list) -> DoneEvent | None:
    """Print a compact event timeline (collapsing chunk spam) and return the
    terminal DoneEvent if the run produced one."""
    chunk_count = 0
    done: DoneEvent | None = None
    for ev in events:
        name = ev.event
        if name == "chunk":
            chunk_count += 1
            continue
        if name == "step":
            print(f"    · step       {ev.step:<12} {ev.label}")
        elif name == "done":
            done = ev if isinstance(ev, DoneEvent) else done
            if isinstance(ev, DoneEvent):
                tier_s = ev.tier.value if ev.tier else "—"
                print(f"    ✓ done       tier={tier_s}  ref={ev.ref}  corr={ev.correlation_id}")
            else:  # InitialPaDoneEvent — no tier/ref; report the determination
                decision = ev.outcome.decision.value if ev.outcome else "no-submission"
                print(
                    f"    ✓ done       decision={decision}  submission_ref={ev.submission_ref}  "
                    f"corr={ev.correlation_id}"
                )
        elif name == "error":
            print(f"    ✗ error      {ev.message}  corr={ev.correlation_id}")
    if chunk_count:
        print(f"    … {chunk_count} chunk events (letter streamed)")
    return done


async def _run_appeal(scenario_id: str, criteria: list[CriterionResult]) -> DoneEvent | None:
    events = [
        e async for e in run_pipeline(_request(scenario_id, criteria), llm_backend=MockLLMBackend())
    ]
    return _print_timeline(events)


def _print_pending() -> list:
    reviews = derive_pending_reviews(all_records(TenancyScope.platform()), is_run_parked)
    if not reviews:
        print("    (queue empty)")
    for r in reviews:
        print(f"    ▸ {r.correlation_id}  {r.drug} / {r.plan}  tier={r.tier.value}  parked={r.parked_at}")
    return reviews


def _print_audit_trail() -> None:
    _banner("AUDIT TRAIL (every run — as_is drafts + human_edited sign-offs)")
    records = all_records(TenancyScope.platform())
    if not records:
        print("    (no records)")
    for rec in records:
        tier = rec.tier.value if rec.tier else "—"
        print(
            f"    {rec.outcome:<5} {rec.lifecycle.value:<10} tier={tier:<9} "
            f"prov={rec.provenance.value:<18} key={rec.idempotency_key}"
        )


async def main() -> None:
    reset_audit_log()

    _banner("PATH 1 — ROUTINE (all criteria confidence ≥ 0.95, first-pass pass)")
    await _run_appeal("smoke-routine", [_criterion(0.98), _criterion(0.97)])

    _banner("PATH 2 — COMPLEX (a criterion in [0.70, 0.95) → full-letter review)")
    await _run_appeal("smoke-complex", [_criterion(0.98), _criterion(0.85)])

    _banner("PATH 3 — EXCEPTION (no criteria → park → list-pending → resume)")
    done = await _run_appeal("smoke-exception", [])
    corr = done.correlation_id if done else ""

    print("\n  Pending review queue (derived from the audit trail, ADR-0011):")
    _print_pending()

    print(f"\n  Resuming {corr} as a human reviewer (approve draft as-is)…")
    resume_events = [e async for e in run_resume(corr, edited_text=None)]
    _print_timeline(resume_events)

    print("\n  Pending review queue after resume:")
    _print_pending()

    _banner("PATH 4 — INITIAL PA (/api/pa/submit lifecycle — no LLM in this path)")
    pa_request = InitialPaRequest(
        scenario_id="smoke-initial-pa",
        case_ref="PA-2026-SMOKE",
        drug=_DRUG,
        diagnosis=_DIAGNOSIS,
        plan=_PLAN,
        plan_id=_PLAN_ID,
        requested_therapy=_DRUG,
        criteria_results=[_criterion(0.98)],
    )
    pa_events = [e async for e in run_initial_pa_pipeline(pa_request)]
    _print_timeline(pa_events)

    _print_audit_trail()
    print("\nSmoke tour complete.\n")


if __name__ == "__main__":
    asyncio.run(main())
