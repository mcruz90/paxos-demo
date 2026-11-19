import { describe, expect, it } from 'vitest'
import type { EvalSnapshot } from '../generated/evalSnapshotTypes'
import generatedSource from '../generated/evalSnapshotTypes.ts?raw'
import rawExampleSnapshot from './eval_snapshot.example.json'
import evalSnapshotSchema from './eval_snapshot.schema.json'
import {
  formatExactPValue,
  formatShortCommit,
  formatStageCount,
  formatWilsonRange,
  isDecisionAccepted,
  parseEvalSnapshot,
  summarizeReadiness,
} from './evalSnapshot'
import { validateAgainstSchema } from './evalSnapshotSchemaValidator'

const toPascal = (s: string) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('')
const cloneExample = () => structuredClone(rawExampleSnapshot) as Record<string, any>

describe('eval_snapshot schema contract & generated TS types', () => {
  it('keeps evalSnapshotTypes.ts synced with every $def and top-level required property', () => {
    expect(generatedSource).toContain('export interface EvalSnapshot')
    for (const defName of Object.keys(evalSnapshotSchema.$defs)) {
      expect(generatedSource).toContain(toPascal(defName))
    }
    for (const req of evalSnapshotSchema.required) {
      expect(generatedSource).toMatch(new RegExp(`\\b${req}:`))
    }
  })

  it('validates real eval_snapshot.example.json cleanly and parses to EvalSnapshot', () => {
    expect(validateAgainstSchema(rawExampleSnapshot, evalSnapshotSchema)).toEqual([])
    const parsed = parseEvalSnapshot(rawExampleSnapshot)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const snap: EvalSnapshot = parsed.snapshot
    expect(snap.schema_version).toBe('1')
  })

  it('rejects schema drift: wrong version, missing key, extra prop, bad enum, bad integer/type', () => {
    const wrongVersion = { ...cloneExample(), schema_version: '2' }
    expect(validateAgainstSchema(wrongVersion, evalSnapshotSchema).length).toBeGreaterThan(0)

    const missingClocks = cloneExample()
    delete missingClocks.clocks
    expect(validateAgainstSchema(missingClocks, evalSnapshotSchema).length).toBeGreaterThan(0)

    const extraProp = { ...cloneExample(), invented_field: true }
    expect(validateAgainstSchema(extraProp, evalSnapshotSchema).length).toBeGreaterThan(0)

    const badState = cloneExample()
    badState.readiness.state = 'healthy'
    expect(validateAgainstSchema(badState, evalSnapshotSchema).length).toBeGreaterThan(0)

    const floatCount = cloneExample()
    floatCount.readiness.stages[0].n = 3.5
    expect(validateAgainstSchema(floatCount, evalSnapshotSchema).length).toBeGreaterThan(0)

    const stringErrors = cloneExample()
    stringErrors.readiness.stages[0].errors = '0'
    expect(validateAgainstSchema(stringErrors, evalSnapshotSchema).length).toBeGreaterThan(0)

    const badJudgeStatus = cloneExample()
    badJudgeStatus.appeal_rubric.judge_bar.status = 'draft'
    expect(validateAgainstSchema(badJudgeStatus, evalSnapshotSchema).length).toBeGreaterThan(0)
  })
})

describe('real eval_snapshot.example.json invariants (ADR 0049)', () => {
  it('captures readiness, e2e, appeal_rubric, paired_prompts, and clocks accurately', () => {
    const parsed = parseEvalSnapshot(rawExampleSnapshot)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const { snapshot: s } = parsed

    expect(s.schema_version).toBe('1')
    expect(s.as_of_commit.length).toBeGreaterThan(0)
    expect(s.generated_at.length).toBeGreaterThan(0)
    expect(formatShortCommit(s.as_of_commit)).toBe('8b18c447')

    expect(s.readiness.state).toBe('measured')
    expect(s.readiness.decision.number).toBe('0014')
    expect(isDecisionAccepted(s.readiness.decision)).toBe(true)
    expect(summarizeReadiness(s.readiness.stages)).toEqual({ ready: 1, notYet: 5, noRuns: 1, notBuilt: 3, total: 10 })

    const missingCountStages = s.readiness.stages.filter(st => st.state === 'no_runs' || st.state === 'not_built')
    expect(missingCountStages.map(st => st.id)).toContain('evidence')
    expect(missingCountStages).toHaveLength(4)
    for (const st of missingCountStages) {
      expect(st.errors).toBeUndefined()
      expect(st.n).toBeUndefined()
      expect(formatStageCount(st.errors)).toBe('—')
    }

    expect(s.e2e.state).toBe('measured')
    expect(s.e2e.decision.number).toBe('0047')
    expect(isDecisionAccepted(s.e2e.decision)).toBe(false)
    expect(s.e2e.runs.find(r => r.flow === 'appeal')).toMatchObject({ cases: 420, outcomes: { silent: 0 } })
    expect(s.e2e.runs.find(r => r.flow === 'initial')).toMatchObject({ cases: 300, outcomes: { silent: 0 } })

    expect(s.appeal_rubric.state).toBe('defined')
    expect(s.appeal_rubric.dimensions).toHaveLength(14)
    const judgeDims = s.appeal_rubric.dimensions.filter(d => d.kind === 'judge')
    expect(judgeDims).toHaveLength(4)
    for (const j of judgeDims) {
      expect(j.state).toBe('defined')
      expect(j.calibration).toEqual({ n: 0, kappa: null, calibrated: false })
    }
    expect(s.appeal_rubric.judge_bar).toEqual({ min_letters: 50, min_kappa: 0.6, status: 'proposed' })

    expect(s.paired_prompts.state).toBe('not_run')
    expect(s.paired_prompts.runs).toHaveLength(7)
    expect(s.paired_prompts.comparison).toBeUndefined()

    expect(s.clocks.state).toBe('defined')
    expect(s.clocks.decision.number).toBe('0048')
    expect(isDecisionAccepted(s.clocks.decision)).toBe(false)
    expect(s.clocks.clocks).toHaveLength(1)
    expect(s.clocks.clocks[0].citation).toBe('42 CFR 423.568(b)')
    expect(s.clocks.not_applicable).toHaveLength(1)
    expect(s.clocks.not_applicable[0].rule).toBe('CMS-0057-F')
  })

  it('validates a measured paired_prompts comparison payload without rounding tiny p_value', () => {
    const withPair = cloneExample()
    withPair.paired_prompts = {
      state: 'measured',
      runs: withPair.paired_prompts.runs,
      comparison: {
        a: { run_id: 'run-a', prompt_version: 'p-1', request_version: 'r-1' },
        b: { run_id: 'run-b', prompt_version: 'p-2', request_version: 'r-2' },
        left_out: 2,
        gaps: 120,
        a_correct: 95,
        b_correct: 112,
        a_range: [0.71, 0.85],
        b_range: [0.87, 0.96],
        fixed: 18,
        broke: 1,
        new_silent_errors: 0,
        p_value: 0.0000123,
        decision: 'accept_b',
      },
    }
    expect(validateAgainstSchema(withPair, evalSnapshotSchema)).toEqual([])
  })
})

describe('snapshot formatting helpers', () => {
  it('formats exact p_value without rounding tiny values to 0.0', () => {
    expect(formatExactPValue(1e-8)).toBe('1.0000e-8')
    expect(formatExactPValue(0.0000123)).toBe('1.2300e-5')
    expect(formatExactPValue(0.03125)).toBe('0.03125')
    expect(formatExactPValue(1)).toBe('1')
  })

  it('formats Wilson ranges and missing counts without substituting 0', () => {
    expect(formatWilsonRange([0, 0.0111])).toBe('0.00%–1.11%')
    expect(formatWilsonRange(null)).toBe('—')
    expect(formatWilsonRange(undefined)).toBe('—')
    expect(formatStageCount(undefined)).toBe('—')
    expect(formatStageCount(null)).toBe('—')
    expect(formatStageCount(0)).toBe('0')
  })
})
