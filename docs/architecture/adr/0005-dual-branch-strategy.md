# ADR-0005: Dual-branch strategy — `demo` (mock UI) vs `main` (real build)

- **Status:** Accepted
- **Date:** 2026-07-02 (backfilled; strategy set at project inception)
- **Decided by:** May

## Context

The repo serves two audiences at once: a **portfolio demo** that must look
polished and run flawlessly offline, and a **real build** whose value is
correctness, tests, and architecture. Mixing them on one branch forces bad
trade-offs in both directions (demo polish blocking backend refactors; WIP
backend breaking the deployed demo).

## Decision

- **`demo`** is the presentation branch: the polished scenario-driven UI,
  deployed automatically to DigitalOcean as a static site (`app.yaml`,
  `deploy_on_push: true`). It runs entirely on fixture data and never
  requires a backend. Implementation specifics stay off this branch.
- **`main`** is the real build: backend pipeline, golden set, CI gates,
  hardening work. Feature branches (TDD vertical slices) merge here.
- The demo UI's scenario fixtures mirror the golden-set anchors so the two
  branches tell the same domain story (parity-guarded — see
  [ADR-0004](0004-golden-set-canonical-dataset.md)).
- Known intentional debt is allowed on the demo side and documented as such
  in CLAUDE.md (the `App.tsx` god file, `scenarios.tsx` size) — it is not a
  license for debt on `main`.

## Consequences

- The deployed demo is stable regardless of backend churn.
- Periodic `demo` ↔ `main` syncs are manual and must be deliberate (the
  branches have merged before; conflicts concentrate in shared frontend
  files).
- Anyone reading the repo must know which branch they're on before judging
  it — the demo branch is *supposed* to be a mock. This ADR is the pointer.
