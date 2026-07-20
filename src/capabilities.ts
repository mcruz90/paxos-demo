/**
 * Capability manifest — the single projection of live/demo mode onto UI units
 * (ADR-0016; spec: docs/architecture/13-capability-manifest.md).
 *
 * The mode itself is decided once, at the data layer (liveMode.ts). This
 * module turns that one boolean into a typed per-unit answer the shell
 * composes by. Unit components never read LIVE_MODE and never branch on mode;
 * they receive data and, where labeling matters, their capability as a prop.
 *
 * A unit is promoted `simulated → live` here, in the same PR that wires its
 * backend — never before, and never as a side effect (the ADR-0014 honesty
 * rule applied to the seam). Unlisted units are implicitly part of the
 * simulated demo tree; listing a unit is what puts it under the seam's
 * control.
 */
export type UnitCapability = 'live' | 'simulated' | 'hidden'

/** Unit IDs follow docs/design/ui-unit-exploration.md so the manifest, the
 * exploration map, and the sprint plan share one vocabulary. */
export const UNIT_IDS = [
  /** O4 — streaming appeal-letter generation (SSE POST /api/appeal/generate),
   * the stream that feeds O4's Full Review tier; the real stream replaces the
   * portfolio LetterGeneration re-simulation (Workstream SU slice 2). Named to
   * match the sprint plan's "O4/streaming generate"; see 11-sprint-plan.md and
   * docs/design/ui-unit-exploration.md. */
  'O4_generate',
  /** O5 — exception resolver resume (POST /api/appeal/resume). */
  'O5_resume',
  /** O7 — pending-review queue over GET /api/reviews/pending (ADR-0011). */
  'O7_pending_queue',
  /** The fixture-driven portfolio case queue — the simulated demo tree. */
  'O7_portfolio_queue_sim',
  /** B8 — audit-trail explorer over GET /api/audit/records (ADR-0009). */
  'B8_audit_trail',
] as const
export type UnitId = (typeof UNIT_IDS)[number]

export type CapabilityManifest = Record<UnitId, UnitCapability>

/**
 * Pure projection: mode → manifest. Demo mode (`liveMode === false`, the
 * static-site deploy) must never mark a unit `live` — there is no backend to
 * call; the live-only units hide because the demo tells its own simulated
 * story. The fixture queue stays `simulated` in both modes: in live mode it
 * renders under the SIMULATED chip rather than impersonating live cases.
 */
export function buildManifest(liveMode: boolean): CapabilityManifest {
  return {
    // Live generate stream in live mode; the fixture-driven re-simulation
    // (LetterGeneration) in demo mode — the static deploy has no backend.
    O4_generate: liveMode ? 'live' : 'simulated',
    O5_resume: liveMode ? 'live' : 'hidden',
    O7_pending_queue: liveMode ? 'live' : 'hidden',
    O7_portfolio_queue_sim: 'simulated',
    B8_audit_trail: liveMode ? 'live' : 'hidden',
  }
}

/** On-screen chip text for a capability; `hidden` units render nothing. */
export function capabilityLabel(cap: UnitCapability): string | null {
  if (cap === 'hidden') return null
  return cap === 'live' ? 'LIVE' : 'SIMULATED'
}

/** What the shell chrome (Topbar badge, Sidebar wordmark) says this build is.
 * Both modes are demos of ClearAuth today — the distinction the chrome makes
 * (May's ruling 2026-07-18) is fixtures-with-zero-backend-calls vs. real
 * backend connections, so a live build must not wear the Demo badge. */
export interface ShellModeBadge {
  label: string
  wordmark: string
  /** Tailwind classes for the Topbar badge chip. */
  cls: string
}

export function shellModeBadge(liveMode: boolean): ShellModeBadge {
  if (liveMode) {
    return {
      label: 'Live',
      wordmark: 'ClearAuth',
      cls: 'text-emerald-400/90 bg-emerald-500/10 border-emerald-500/25',
    }
  }
  return {
    label: 'Demo',
    wordmark: 'ClearAuth (Demo)',
    cls: 'text-amber-400/90 bg-amber-500/10 border-amber-500/25',
  }
}
