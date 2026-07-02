# ADR-0004: The golden set is the canonical test/eval dataset

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; established Sprint 0, wired Sprint 1)
- **Decided by:** May

## Context

Scenario data (drugs, payers, PA criteria, denial reasons) is needed by
backend tests, evals, retrieval packs, and the demo UI. Ad-hoc duplication
would let the copies drift — and in a domain where the data encodes real
payer policy, drift means testing against fiction.

## Decision

One canonical dataset, adapted per consumer:

- **Substance:** sourcing rules, data classes, provenance (SHA256, retrieval
  dates), and the PHI prohibition are governed by
  [/docs/golden-set-governance.md](../../golden-set-governance.md) — that
  document is authoritative; this ADR only records the architectural role.
- **Shape:** `backend/evals/fixtures/scenarios.json` (validated by
  `EvalScenario`) is the labeled record set; `backend/golden/` holds the
  sourced policies, procedures, regulatory rules, and synthetic identity/
  coverage pools it derives from.
- **Distribution is via adapters, never copies:**
  `evals/fixtures_adapter.py` → `AppealRequest`/`ScenarioConfig` for tests
  and evals; `data/pa_requirements.json` is *seeded from* the fixtures for
  retrieval; `src/data/scenarios.tsx` mirrors the anchors for the demo UI
  with drift gated by `scenarios_parity.test.ts`.
- Test files import the fixture; they never restate scenario data inline
  (CLAUDE.md DRY).
- New domain claims (a new drug, payer policy, clinical criterion) enter the
  golden set only through the research-and-cite workflow (CLAUDE.md §Domain
  Research), never by plausible invention.

## Consequences

- A policy correction is a one-place edit that propagates through adapters;
  the compliance scan (`test_golden_compliance.py`, a CI gate) and parity
  guards catch stale copies.
- Adding an anchor is deliberate work (source → provenance → fixture →
  parity), which is the point — the dataset stays auditable.
- The frontend mirror remains a hand-maintained copy until the post-demo
  split; the parity test is what makes that tolerable.
