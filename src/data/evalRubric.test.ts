import { describe, expect, it } from 'vitest'
import * as evalRubric from './evalRubric'
import { JUDGE_CALIBRATION_SPEC, RUBRIC_DIMENSIONS } from './evalRubric'
import * as evalRun from './evalRun'
import { DEFAULT_EVAL_SNAPSHOT } from './evalSnapshot'

describe('evalRubric and evalRun alignment with clearauth-eval', () => {
  it('contains no RAGAS, GEval, or LLM-as-judge labels', () => {
    const allowed = new Set(['Deterministic', 'Entailment', 'Advisory Judge', 'Red-team'])
    for (const d of RUBRIC_DIMENSIONS) {
      expect(allowed.has(d.method)).toBe(true)
      const blob = `${d.method} ${d.grader} ${d.measures}`
      expect(blob).not.toMatch(/ragas|geval|llm-as-judge/i)
    }
    expect(RUBRIC_DIMENSIONS.some(d => d.method === 'Deterministic')).toBe(true)
    expect(RUBRIC_DIMENSIONS.some(d => d.method === 'Entailment')).toBe(true)
    const judgeDims = RUBRIC_DIMENSIONS.filter(d => d.method === 'Advisory Judge')
    expect(judgeDims).toHaveLength(4)
    for (const j of judgeDims) {
      expect(j.status).toBe('not_built')
    }
  })

  it('does not expose mock calibrated clinician-panel metrics', () => {
    expect('JUDGE_CALIBRATION' in evalRubric).toBe(false)
    expect(JUDGE_CALIBRATION_SPEC).toMatchObject({
      status: 'not_built',
      reviewedLetters: 0,
      proposedMinLetters: 50,
      proposedMinKappa: 0.6,
    })
  })

  it('does not export illustrative eval runs, runtime profiles, or fixture suite sizes; judge dims stay defined/uncalibrated in snapshot', () => {
    expect('MOCK_EVAL_RUN' in evalRun).toBe(false)
    expect('RUNTIME_PROFILE' in evalRun).toBe(false)
    expect('SUITE_SIZE' in evalRun).toBe(false)

    const judgeDims = DEFAULT_EVAL_SNAPSHOT!.appeal_rubric.dimensions.filter(d => d.kind === 'judge')
    expect(judgeDims).toHaveLength(4)
    for (const j of judgeDims) {
      expect(j.state).toBe('defined')
      expect(j.calibration).toEqual({ n: 0, kappa: null, calibrated: false })
    }
  })
})
