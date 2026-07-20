import { describe, expect, it } from 'vitest'
import { UNIT_IDS, buildManifest, capabilityLabel, shellModeBadge } from './capabilities'

// ADR-0016 / docs/architecture/13-capability-manifest.md: the manifest is the
// single projection of the live/demo mode onto UI units.

describe('buildManifest — demo (simulated) mode', () => {
  const manifest = buildManifest(false)

  it('never marks any unit live — the static demo deploy has no backend', () => {
    for (const id of UNIT_IDS) {
      expect(manifest[id], id).not.toBe('live')
    }
  })

  it('keeps the fixture-driven portfolio queue as the simulated demo tree', () => {
    expect(manifest.O7_portfolio_queue_sim).toBe('simulated')
  })

  it('hides the live-only units — the demo tells its own simulated story', () => {
    expect(manifest.O5_resume).toBe('hidden')
    expect(manifest.O7_pending_queue).toBe('hidden')
    expect(manifest.B8_audit_trail).toBe('hidden')
  })

  it('marks O4_generate simulated — the generate pipeline is live, but demo has no backend', () => {
    expect(manifest.O4_generate).toBe('simulated')
  })
})

describe('buildManifest — live mode', () => {
  const manifest = buildManifest(true)

  it('marks exactly the LIVE-backed slice-1 units live', () => {
    expect(manifest.O5_resume).toBe('live')
    expect(manifest.O7_pending_queue).toBe('live')
    expect(manifest.B8_audit_trail).toBe('live')
  })

  it('keeps the fixture queue simulated — fixture data never impersonates live', () => {
    expect(manifest.O7_portfolio_queue_sim).toBe('simulated')
  })

  it('marks O4_generate live — SU slice 2 wires the real generate SSE stream', () => {
    expect(manifest.O4_generate).toBe('live')
  })
})

describe('shellModeBadge — chrome says which mode this build is', () => {
  it('demo build keeps the Demo badge and (Demo) wordmark', () => {
    const badge = shellModeBadge(false)
    expect(badge.label).toBe('Demo')
    expect(badge.wordmark).toBe('ClearAuth (Demo)')
  })

  it('live build wears Live and drops (Demo) from the wordmark', () => {
    const badge = shellModeBadge(true)
    expect(badge.label).toBe('Live')
    expect(badge.wordmark).toBe('ClearAuth')
  })
})

describe('capabilityLabel — honest on-screen labeling', () => {
  it('labels live and simulated units; hidden units render nothing', () => {
    expect(capabilityLabel('live')).toBe('LIVE')
    expect(capabilityLabel('simulated')).toBe('SIMULATED')
    expect(capabilityLabel('hidden')).toBeNull()
  })
})
