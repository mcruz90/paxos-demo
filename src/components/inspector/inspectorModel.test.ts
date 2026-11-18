import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import type { DoneEvent } from '../../lib/wire'
import {
  CLEARAUTH_EVAL_STAGES,
  DUAL_REVIEWER_KAPPA,
  buildGateAssertions,
  buildRunMetadata,
} from './inspectorModel'

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
    expect(gates.find(g => g.key === 'drug_name_present')).toMatchObject({
      status: 'pass',
      value: 'PASS (1)',
    })
    expect(gates.find(g => g.key === 'section_present')).toMatchObject({
      status: 'fail',
      value: 'FAIL (0)',
    })
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

describe('CLEARAUTH_EVAL_STAGES and DUAL_REVIEWER_KAPPA', () => {
  it('exposes all 6 clearauth-eval pipeline stages with sample sizes and 95% CIs', () => {
    expect(CLEARAUTH_EVAL_STAGES).toHaveLength(6)
    expect(CLEARAUTH_EVAL_STAGES.map(s => s.module)).toEqual([
      'doc_type_eval',
      'intake_eval + llm_fallback',
      'deid_eval',
      'rxnorm',
      'chart_eval',
      'appeal_eval',
    ])
    for (const s of CLEARAUTH_EVAL_STAGES) {
      expect(s.n).toBeGreaterThan(0)
      expect(s.ci95).toMatch(/\d+\.\d+%–\d+\.\d+%/)
    }
  })

  it('tracks dual-reviewer agreement and kappa threshold for Stage 5 readiness', () => {
    expect(DUAL_REVIEWER_KAPPA).toMatchObject({
      sampleCriteria: 82,
      agreementPct: 96.3,
      kappa: 0.84,
      targetKappa: 0.8,
      stage5Ready: true,
      graduatedEdits: 14,
    })
  })
})
