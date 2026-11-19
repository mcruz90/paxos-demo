import { describe, expect, it } from 'vitest'
import type { EvalSnapshot } from '../generated/evalSnapshotTypes'
import generatedSource from '../generated/evalSnapshotTypes.ts?raw'
import rawExampleSnapshot from './eval_snapshot.example.json'
import evalSnapshotSchema from './eval_snapshot.schema.json'
import {
  NOT_IN_SNAPSHOT,
  findNotBuiltItem,
  formatCaseSetEntries,
  formatClearauthDecisionLabel,
  formatExactPValue,
  formatShortCommit,
  formatSnapshotSourceNote,
  formatStageCount,
  formatWilsonRange,
  isDecisionAccepted,
  parseEvalSnapshot,
  summarizeReadiness,
} from './evalSnapshot'
import { validateAgainstSchema } from './evalSnapshotSchemaValidator'

const toPascal = (s: string) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join('')
const cloneExample = () => structuredClone(rawExampleSnapshot) as Record<string, any>

describe('eval_snapshot schema v2 contract & generated TS types', () => {
  it('keeps evalSnapshotTypes.ts synced with every $def and top-level required property', () => {
    expect(generatedSource).toContain('export interface EvalSnapshot')
    for (const defName of Object.keys(evalSnapshotSchema.$defs)) {
      expect(generatedSource).toContain(toPascal(defName))
    }
    for (const req of evalSnapshotSchema.required) {
      expect(generatedSource).toMatch(new RegExp(`\\b${req}:`))
    }
  })

  it('accepts schema version 2 example and parses to EvalSnapshot', () => {
    expect(validateAgainstSchema(rawExampleSnapshot, evalSnapshotSchema)).toEqual([])
    const parsed = parseEvalSnapshot(rawExampleSnapshot)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const snap: EvalSnapshot = parsed.snapshot
    expect(snap.schema_version).toBe('2')
  })

  it('rejects schema version 1 and drift (missing v2 keys, extra prop, bad enum, bad types)', () => {
    const wrongVersion = { ...cloneExample(), schema_version: '1' }
    expect(validateAgainstSchema(wrongVersion, evalSnapshotSchema).length).toBeGreaterThan(0)

    const pureV1Shape: Record<string, any> = { ...cloneExample(), schema_version: '1' }
    delete pureV1Shape.redteam
    delete pureV1Shape.case_sets
    delete pureV1Shape.not_built
    expect(validateAgainstSchema(pureV1Shape, evalSnapshotSchema).length).toBeGreaterThan(0)

    for (const key of ['clocks', 'redteam', 'case_sets', 'not_built'] as const) {
      const missing = cloneExample()
      delete missing[key]
      expect(validateAgainstSchema(missing, evalSnapshotSchema).length).toBeGreaterThan(0)
    }

    const extraProp = { ...cloneExample(), invented_field: true }
    expect(validateAgainstSchema(extraProp, evalSnapshotSchema).length).toBeGreaterThan(0)

    const badRedteamKind = cloneExample()
    badRedteamKind.redteam.kinds[0].kind = 'redteam_dev'
    expect(validateAgainstSchema(badRedteamKind, evalSnapshotSchema).length).toBeGreaterThan(0)

    const badNotBuiltId = cloneExample()
    badNotBuiltId.not_built.items[0].id = 'unknown_gap'
    expect(validateAgainstSchema(badNotBuiltId, evalSnapshotSchema).length).toBeGreaterThan(0)

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

  it('rejects unsupported JSON Schema keywords instead of silently ignoring them (N8)', () => {
    const withMinimum = { type: 'number', minimum: 0 }
    const directErrors = validateAgainstSchema(5, withMinimum as any)
    expect(directErrors.some(e => e.includes('minimum'))).toBe(true)

    const schemaWithPattern = structuredClone(evalSnapshotSchema) as Record<string, any>
    schemaWithPattern.$defs.comparison.properties.decision.pattern = '^[a-z_]+$'
    const nestedErrors = validateAgainstSchema(rawExampleSnapshot, schemaWithPattern)
    expect(nestedErrors.some(e => e.includes('pattern'))).toBe(true)

    const schemaWithBadAddl = { type: 'object', additionalProperties: { type: 'string' } }
    const addlErrors = validateAgainstSchema({}, schemaWithBadAddl as any)
    expect(addlErrors.some(e => e.includes('additionalProperties'))).toBe(true)
  })
})

describe('real eval_snapshot.example.json v2 invariants (clearauth-eval decision 0049)', () => {
  it('captures readiness, e2e, appeal_rubric, paired_prompts, clocks, redteam, case_sets, and not_built', () => {
    const parsed = parseEvalSnapshot(rawExampleSnapshot)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const { snapshot: s } = parsed

    expect(s.schema_version).toBe('2')
    expect(formatShortCommit(s.as_of_commit)).toBe('c2045304')
    expect(formatSnapshotSourceNote(s)).toBe(
      `Example snapshot (clearauth-eval PR #219). Contract: clearauth-eval decision 0049 · ${s.not_built.decision.status}.`,
    )
    expect(formatSnapshotSourceNote(null)).toBe(
      `Example snapshot (clearauth-eval PR #219). Contract: ${NOT_IN_SNAPSHOT}.`,
    )

    expect(s.readiness.state).toBe('measured')
    expect(s.readiness.decision.number).toBe('0014')
    expect(isDecisionAccepted(s.readiness.decision)).toBe(true)
    expect(summarizeReadiness(s.readiness.stages)).toEqual({ ready: 1, notYet: 5, noRuns: 1, notBuilt: 3, total: 10 })

    expect(s.e2e.state).toBe('measured')
    expect(s.e2e.decision.number).toBe('0047')
    expect(s.e2e.runs.find(r => r.flow === 'appeal')).toMatchObject({ cases: 420, outcomes: { silent: 0 } })
    expect(s.e2e.runs.find(r => r.flow === 'initial')).toMatchObject({ cases: 300, outcomes: { silent: 0 } })

    expect(s.appeal_rubric.state).toBe('defined')
    expect(s.appeal_rubric.dimensions).toHaveLength(14)
    expect(s.appeal_rubric.judge_bar).toEqual({ min_letters: 50, min_kappa: 0.6, status: 'proposed' })
    expect(s.paired_prompts.state).toBe('not_run')
    expect(s.clocks.clocks[0].citation).toBe('42 CFR 423.568(b)')

    expect(s.redteam.state).toBe('measured')
    expect(s.redteam.decision).toEqual({ number: '0004', status: 'Accepted' })
    expect(s.redteam.run_id).toBe('intake-port-full-b635170-20261021T005151Z')
    expect(s.redteam.kinds).toEqual([
      { kind: 'redteam', held: 72, n: 72, not_held: 0, not_held_range95: [0.0, 0.0507] },
      { kind: 'redteam_holdout', held: 72, n: 78, not_held: 6, not_held_range95: [0.0357, 0.1578] },
    ])

    expect(s.case_sets.state).toBe('measured')
    expect(s.case_sets.decision.number).toBe('0049')
    expect(isDecisionAccepted(s.case_sets.decision)).toBe(true)
    expect(s.case_sets.families.map(f => [f.family, f.cases])).toEqual([
      ['intake', 2066],
      ['llm_fallback', 165],
      ['deid', 720],
      ['charts', 300],
      ['doc_type', 990],
    ])

    expect(s.not_built.state).toBe('not_built')
    expect(s.not_built.decision.number).toBe('0049')
    expect(s.not_built.items.map(i => i.id)).toEqual([
      'runtime_cost',
      'per_case_results',
      'rubric_history',
      'site_readiness',
    ])
    expect(findNotBuiltItem(s, 'runtime_cost')?.name).toBe('Runtime, model routing and cost per case')
    expect(findNotBuiltItem(null, 'runtime_cost')).toBeNull()
    expect(findNotBuiltItem({ not_built: { ...s.not_built, items: [] } }, 'runtime_cost')).toBeNull()
  })

  it('validates a measured paired_prompts comparison payload without rounding tiny p_value', () => {
    const withPair = cloneExample()
    withPair.paired_prompts = {
      state: 'measured',
      runs: withPair.paired_prompts.runs,
      comparison: {
        a: { run_id: 'run-a', prompt_version: 'p-1', request_version: 'r-1' },
        b: { run_id: 'run-b', prompt_version: 'p-2', request_version: 'r-2' },
        left_out: 2, gaps: 120, a_correct: 95, b_correct: 112,
        a_range: [0.71, 0.85], b_range: [0.87, 0.96],
        fixed: 18, broke: 1, new_silent_errors: 0, p_value: 0.0000123, decision: 'accept_b',
      },
    }
    expect(validateAgainstSchema(withPair, evalSnapshotSchema)).toEqual([])
  })
})

describe('snapshot formatting helpers', () => {
  it('formats exact p_value without rounding tiny values to 0.0', () => {
    expect(formatExactPValue(1e-8)).toBe('1.0000e-8')
    expect(formatExactPValue(0.03125)).toBe('0.03125')
  })

  it('formats clearauth-eval decision status verbatim from snapshot without hardcoding Proposed/Accepted', () => {
    expect(formatClearauthDecisionLabel({ number: '0014', status: 'Accepted' })).toBe('clearauth-eval decision 0014 · Accepted')
    expect(formatClearauthDecisionLabel({ number: '0047', status: "Proposed (needs May's review)" })).toBe(
      "clearauth-eval decision 0047 · Proposed (needs May's review)",
    )
    expect(formatClearauthDecisionLabel({ number: '0049', status: 'Under custom review' })).toBe(
      'clearauth-eval decision 0049 · Under custom review',
    )
    expect(formatClearauthDecisionLabel(null)).toBe('not in this snapshot')
    expect(formatCaseSetEntries({ benign: 404, holdout: 404, bad: 'x' })).toEqual([
      ['benign', 404],
      ['holdout', 404],
    ])
  })

  it('formats Wilson ranges and missing counts without substituting 0', () => {
    expect(formatWilsonRange([0, 0.0111])).toBe('0.00%–1.11%')
    expect(formatWilsonRange(null)).toBe('—')
    expect(formatStageCount(undefined)).toBe('—')
    expect(formatStageCount(0)).toBe('0')
  })
})
