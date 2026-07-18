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
