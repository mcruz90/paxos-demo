import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import type { DoneEvent } from '../../lib/wire'
import * as inspectorModel from './inspectorModel'
import { EVAL_SNAPSHOT_PLACEHOLDER, buildGateAssertions, buildRunMetadata } from './inspectorModel'

describe('buildGateAssertions', () => {
  const livdelzi = scenarios['gilead-livdelzi']
  const ozempic = scenarios['novo-ozempic']

  it('reports not_evaluated across all gates when no live run produced structural_scores', () => {
    const gates = buildGateAssertions(undefined, livdelzi)
    expect(gates.map(g => g.key)).toEqual([
      'drug_name_present',
      'diagnosis_present',
      'safety_conflict_check',
      'criteria_grounded',
      'no_phi_leakage',
    ])
    for (const g of gates) {
      expect(g.status).toBe('not_evaluated')
      expect(g.value).toBe('not evaluated')
      expect(g.value).not.toMatch(/PASS/i)
    }
    expect(gates.find(g => g.key === 'diagnosis_present')?.targetCiteIndex).toBe(0)
    expect(gates.find(g => g.key === 'safety_conflict_check')?.targetCiteIndex).toBeGreaterThanOrEqual(0)
  })

  it('maps real structural_scores from DoneEvent and keeps unmeasured no_phi_leakage as not_evaluated', () => {
    const gates = buildGateAssertions(
      { drug_name_present: 1, diagnosis_present: 1, section_present: 0 },
      ozempic,
    )
    expect(gates.find(g => g.key === 'drug_name_present')).toMatchObject({ status: 'pass', value: 'PASS (1)' })
    expect(gates.find(g => g.key === 'section_present')).toMatchObject({ status: 'fail', value: 'FAIL (0)' })
    expect(gates.find(g => g.key === 'no_phi_leakage')).toEqual({
      key: 'no_phi_leakage',
      label: 'no_phi_leakage',
      status: 'not_evaluated',
      value: 'not evaluated',
    })
  })
})

describe('buildRunMetadata', () => {
  it('returns not evaluated placeholders when no DoneEvent exists', () => {
    expect(buildRunMetadata(undefined)).toEqual({
      correlationId: 'not evaluated',
      artifactRef: 'not evaluated',
      model: 'not evaluated',
      resolution: 'not evaluated',
      tier: null,
      isSimulated: true,
    })
  })

  it('projects actual DoneEvent fields without fallback mock names', () => {
    const done: DoneEvent = {
      event: 'done',
      correlation_id: 'case-123:a1',
      ref: 'art_9f2a',
      model: 'groq/llama-3.3-70b-versatile',
      pa_resolution: 'plan_id',
      retry_count: 0,
      tier: 'complex',
      structural_scores: { drug_name_present: 1 },
    }
    expect(buildRunMetadata(done)).toEqual({
      correlationId: 'case-123:a1',
      artifactRef: 'art_9f2a',
      model: 'groq/llama-3.3-70b-versatile',
      resolution: 'plan_id',
      tier: 'complex',
      isSimulated: false,
    })
  })
})

describe('snapshot placeholder without hardcoded benchmark numbers', () => {
  it('does not export CLEARAUTH_EVAL_STAGES or DUAL_REVIEWER_KAPPA', () => {
    expect(Object.keys(inspectorModel)).not.toContain('CLEARAUTH_EVAL_STAGES')
    expect(Object.keys(inspectorModel)).not.toContain('DUAL_REVIEWER_KAPPA')
    expect(EVAL_SNAPSHOT_PLACEHOLDER.state).toBe('not_run')
  })
})
