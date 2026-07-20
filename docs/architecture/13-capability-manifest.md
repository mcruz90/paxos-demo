# 13 — Capability Manifest (single-shell live/demo seam)

*Written 2026-07-17, the keystone artifact of
[ADR-0016](adr/0016-single-shell-capability-manifest.md). This doc is the
spec; the implementation is `src/capabilities.ts`.*

## What it is

One typed map from **UI unit** to **capability**:

```ts
export type UnitCapability = 'live' | 'simulated' | 'hidden'
export type CapabilityManifest = Record<UnitId, UnitCapability>
```

- **`live`** — the unit renders data from the backend API. Only allowed for
  units whose backend contract is LIVE (per
  [ui-unit-exploration.md](../design/ui-unit-exploration.md) statuses).
- **`simulated`** — the unit renders fixture data. In live mode it must carry
  the "Simulated" chip (see Labeling); in demo mode it renders unlabeled
  (the whole app is the demo).
- **`hidden`** — the unit does not render at all in this mode. Used when a
  simulated unit has no honest place beside live data.

Unit IDs use the exploration map's stable identifiers (`O5_resume`,
`O7_pending_queue`, `B8_audit_trail`, …) so the manifest, the exploration
doc, and the sprint plan all speak the same vocabulary.

## Where the seam lives (and where it doesn't)

The mode decision stays exactly where Sprint FI put it: **the data layer**,
keyed off `VITE_API_BASE_URL` (`src/components/poc/live/liveMode.ts` — the
one switch point). The manifest is a **pure projection of that one boolean**:

```ts
buildManifest(liveMode: boolean): CapabilityManifest
```

Rules, in enforcement order:

1. **Unit components never read `LIVE_MODE` and never branch on mode.** They
   receive data (props/hooks) and, where needed, a capability to display.
2. **Only the shell composition layer** (`App.tsx` / `AppShell`) consults the
   manifest, mounting live-backed or fixture-backed units accordingly.
   Manifest-driven composition in the shell is the sanctioned mechanism;
   per-component `if (LIVE_MODE)` is the anti-pattern ADR-0016 exists to
   prevent.
3. **Demo mode is all-`simulated`** (with `hidden` allowed for live-only
   units such as the session gate). `buildManifest(false)` must never return
   `live` for any unit — the static demo deploy has no backend to call.
4. **Live mode marks exactly the LIVE-backed units `live`.** A unit is
   promoted `simulated → live` in the same PR that wires its backend, never
   before (no capability shown as live before it exists — the ADR-0014
   honesty rule applied to the seam) and never as a side effect.

## Labeling — how a simulated unit is honest on screen

- **Live mode:** every unit surface carries a capability chip. `live` units
  render the `LIVE` chip (emerald); `simulated` units render the `SIMULATED`
  chip (slate/purple) adjacent to the unit's header so fixture data can
  never be mistaken for a live case. A unit that cannot wear the chip
  legibly (e.g. it would imply a live action on fake data, like a real payer
  submission from a fixture case) is `hidden` instead.
- **Demo mode:** no per-unit chips. The deploy itself is the labeled demo
  (ADR-0005); chip-spam would drown the design.
- **Shell chrome** carries the build's mode (`shellModeBadge`): fixture
  builds wear the Demo badge / "ClearAuth (Demo)" wordmark, live builds wear
  Live / "ClearAuth" (May's ruling 2026-07-18 — both modes are demos of the
  product today; what the chrome distinguishes is zero-backend fixtures vs.
  real backend connections).
- The chip component (`CapabilityChip`) is shared UI; units receive their
  capability as a prop from the shell — they never compute it.

## Migration contract

- Slice 1 (2026-07-17): `O5_resume`, `O7_pending_queue`, `B8_audit_trail`
  are `live` in live mode, rendered inside the portfolio shell.
- Slice 2 (2026-07-20): `O4_generate` (streaming appeal-letter generation) is
  `live` in live mode / `simulated` in demo mode. In live mode the portfolio
  case workspace drives the real `POST /api/appeal/generate` SSE stream
  (`LiveLetterGeneration` → `useLiveAppeal.run`), replacing the
  `LetterGeneration` re-simulation; demo mode still renders that simulation
  unchanged. Because the case queue feeding it stays a simulated fixture
  (`O7_portfolio_queue_sim`), the unit wears a **compound chip** —
  "LIVE generation · demo case data" (May's decision 2026-07-20) — rather than
  a plain `LIVE` chip that would imply the case data is live too.
- `LiveApp` is a developer console (`?console=dev`, live mode only), not a
  product surface. It empties as units migrate; no new units land there or
  in any demo-only parallel surface (CLAUDE.md rule).
- The manifest grows a row per unit as each is migrated or deliberately
  marked. Unlisted units are implicitly part of the simulated demo tree
  until listed — listing is what puts a unit under the seam's control.
