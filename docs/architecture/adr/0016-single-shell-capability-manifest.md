# ADR-0016: Single-shell destination with incremental migration behind a capability manifest

- **Status:** Accepted
- **Date:** 2026-07-17
- **Decided by:** May (Option 3 of the [X5 seam decision brief](../../design/x5-seam-decision-brief.md), chosen 2026-07-17; no demo date holds back the migration start)

## Context

Two frontend shells grew in parallel: Sprint FI built live wiring (session
auth, typed SSE client, pending queue, audit panel) into `LiveApp`, while the
2026-07-17 UI exploration built the strongest UI in the codebase (patient
profile IA, source-doc viewer, exception resolver, activity log) into the
**demo** shell. Every future unit was getting built twice by default, and the
duplication was already visible (`LetterGeneration` re-simulating the real SSE
client; two letter-review surfaces). The X5 brief laid out three options:
single shell now (1), parallel shells until the backend catches up (2), and
single-shell destination with incremental migration (3).

## Decision

We adopt **Option 3**: the portfolio/demo shell is the single product shell;
migration is executed unit-by-unit behind a **capability manifest**.

1. **One shell.** The portfolio UI (today's simulated demo tree) is *the*
   product UI. Demo mode is that shell running on the simulated fixture data
   source; live mode is the same shell with API-backed units.
2. **Capability manifest.** A single typed map `unit → live | simulated |
   hidden` (spec: [13-capability-manifest.md](../13-capability-manifest.md))
   is the only place mode is projected onto units. The mode seam stays where
   Sprint FI put it — the data layer, keyed off `VITE_API_BASE_URL`
   (`liveMode.ts`, the one switch point). Unit components never branch on
   mode; the shell composes them according to the manifest.
3. **Honest labeling.** In live mode, a unit whose capability is `simulated`
   renders under an explicit "Simulated" chip; a capability with no honest
   on-screen story is `hidden`, not silently mocked. In simulated (demo) mode
   no per-unit chips render — the whole app is the labeled demo.
4. **Migration slice 1 = the already-live flows**: O5 exception resume, O7
   pending-review queue, B8 audit trail, rendered inside the portfolio shell
   behind the manifest.
5. **`LiveApp` demotes to a developer console** (opt-in via `?console=dev` in
   live mode) and empties out as units migrate. **No new units land in the
   old shells** (`LiveApp`, or any demo-only parallel surface) once migration
   starts — rule recorded in CLAUDE.md's frontend-layout section.
6. **The static-site demo deploy keeps working unchanged.** Without
   `VITE_API_BASE_URL` the rendered tree and behavior are identical to
   pre-migration (ADR-0005's deploy mechanics are untouched).

## ADR-0005 review (same pass)

A single shell changes what `demo` vs `main` *mean*, so ADR-0005 was reviewed
as part of this decision. Outcome: **retained, amended** (see the amendment
note in [ADR-0005](0005-dual-branch-strategy.md)). The branch mechanics stay —
`demo` still deploys a zero-backend static site on push — but the demo is no
longer a *separate mock UI*: it is the product shell running the simulated
data source. "Implementation specifics stay off the demo branch" softens to
"the demo branch deploys with `VITE_API_BASE_URL` unset"; the honesty burden
moves from branch separation to the capability manifest.

## Consequences

Easier:
- Every surface is built once; the exploration work becomes product, not mock.
- Each migration slice is independently testable; no big-bang refactor.
- The manifest gives the demo an honest per-unit capability story — the same
  no-capability-shown-as-live-before-it-exists rule ADR-0014 applies to the
  PHI posture.

Harder / committed work:
- A transitional period with three surfaces (demo tree, demoted `LiveApp`,
  migrating portfolio units) — held in check by the no-new-units rule and the
  migration sequence in [11-sprint-plan.md](../11-sprint-plan.md).
- The manifest must be kept truthful as backends land: promoting a unit
  `simulated → live` is a deliberate manifest change in the same PR as the
  wiring, never a side effect.
- Demo-only code paths must stay out of live rendering: a `simulated` unit in
  live mode renders fixture data *labeled as such*, and a unit that cannot do
  that honestly is `hidden`.

Rejected alternatives: Option 1 (big-bang single shell now — destabilizes
both tracks mid-stream) and Option 2 (parallel shells — duplication compounds
every sprint and the demo becomes a spec the live shell perpetually chases).
