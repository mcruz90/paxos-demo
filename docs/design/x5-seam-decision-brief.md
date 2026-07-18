# X5 — Live/Demo Seam: Decision Brief

*2026-07-17. Discussion artifact for the X5 open question in
[ui-unit-exploration.md](ui-unit-exploration.md). **DECIDED — May chose
Option 3**, recorded in
[ADR-0016](../architecture/adr/0016-single-shell-capability-manifest.md)
(single-shell destination, incremental migration behind the capability
manifest, [spec](../architecture/13-capability-manifest.md)). This brief
remains as the option analysis behind that ADR.*

## Why this is now urgent

Sprint FI built live wiring (auth, SSE client, pending queue, audit panel)
into a parallel `LiveApp` shell. The 2026-07-17 exploration built the best
UI in the codebase — patient profile IA, source-doc viewer, exception
resolver, activity log — into the **demo** shell. Every future unit now gets
built twice by default, and the duplication is already visible:
`LetterGeneration` re-simulates what `src/lib`'s SSE client actually does;
`PreviewPane` re-implements `DonePanel` concepts; two letter-review surfaces
exist. Each sprint this decision waits, the migration (or the divergence)
gets bigger.

## The options

### Option 1 — Single shell, session-gated

The portfolio/demo UI becomes *the* product UI. Demo mode = a simulated data
source behind the same components; live mode = API-backed. One seam at the
data layer (the existing `VITE_API_BASE_URL` philosophy: a single mode seam,
never per-component branching).

- **Pros:** every surface built once; the exploration work becomes product,
  not mock; design investment compounds instead of forking.
- **Cons:** the demo shell simulates capabilities the backend doesn't have
  (O6 discovery, G7 dispatch rail, O12 round-2, letter streaming). A single
  shell needs an honest per-unit capability story or live mode shows
  fiction. That means designing a **capability manifest** — one typed map of
  unit → `live | simulated | hidden` — which is real up-front work and the
  keystone artifact of this option.
- **Risks:** refactoring mid-Sprint-FI destabilizes both tracks; demo-only
  code paths leaking into the live bundle; the ADR-0005 static-site deploy
  (zero backend) must keep working byte-identically.

### Option 2 — Parallel shells until the backend catches up

Keep `LiveApp` and the demo shell separate; rebuild the demo's ideas in the
live shell as their backends land.

- **Pros:** zero disruption now; demo velocity stays maximal; the live
  surface stays small and auditable.
- **Cons:** duplication compounds every sprint; "rebuild later" grows
  superlinearly with each unit added to the demo shell.
- **Risk:** the demo becomes the de-facto product spec that the live shell
  perpetually chases — spec-by-mockup instead of spec-first.

### Option 3 — Single-shell destination, incremental migration *(prepared recommendation)*

Adopt Option 1 as the target; execute unit-by-unit behind the capability
manifest. First migration slice = flows whose backend is already LIVE (O5
resume, O7 pending queue, B8 audit trail) rendered inside the portfolio
shell. `LiveApp` demotes to a developer console and empties out.

- **Pros:** no big-bang refactor; each slice independently testable; the
  demo never regresses (simulated stays the default per ADR-0005).
- **Cons:** a transitional period with three surfaces (demo, `LiveApp`,
  migrating portfolio) — requires discipline: **no new units land in the old
  shells once migration starts.**

## Decision inputs (May's to weigh)

1. **Demo timeline** — a hard demo date in the next few weeks favors
   deferring the migration start (Option 2 short-term, Option 3 after).
2. **Pilot timeline** — a live pilot soon favors starting Option 3 now, with
   the already-live flows as slice 1.
3. **Capability-manifest appetite** — Options 1/3 stand on it. It deserves
   its own small spec (the typed manifest, where the seam lives, how a
   simulated unit is labeled on screen honestly).

## What acting on this looks like (once decided)

- An ADR (0016) recording the choice; ADR-0005's dual-branch strategy gets
  reviewed in the same pass (single shell changes what `demo` vs `main`
  means).
- The capability-manifest spec (if Options 1/3).
- A migration sequence added to the sprint plan; the "no new units in old
  shells" rule added to CLAUDE.md's frontend layout section.
