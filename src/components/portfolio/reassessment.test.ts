import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import { EMPTY_LOCAL_CASE_STATE, allExceptionsResolved } from './caseQueue'
import { attachExcerptsOnly, reassessCriterionWithDelta } from './reassessment'

describe('two-step attach -> reassess (findings delta)', () => {
  const livdelzi = scenarios['gilead-livdelzi']
  const conflictCrit = livdelzi.criteriaResults.find(c => c.status === 'conflict')!
  const excerpt = [{ id: 'ehr', title: 'Local chart excerpt', detail: 'Hepatology Consult p.1 excerpt' }]

  it('attachExcerptsOnly records provisional evidence without marking the criterion resolved or overriding status', () => {
    const next = attachExcerptsOnly(EMPTY_LOCAL_CASE_STATE, conflictCrit.rule.label, excerpt, '12:55 PM')
    expect(next.attachedExcerpts?.[conflictCrit.rule.label]).toEqual(excerpt)
    expect(next.overrides[conflictCrit.rule.label]).toBeUndefined()
    expect(next.findingsDeltas?.[conflictCrit.rule.label]).toBeUndefined()
    expect(next.activity.at(-1)?.action).toContain('provisional')
    expect(allExceptionsResolved(livdelzi, next)).toBe(false)
  })

  it('reassessCriterionWithDelta records findings delta preserving priorStatus and priorNote', () => {
    const attached = attachExcerptsOnly(EMPTY_LOCAL_CASE_STATE, conflictCrit.rule.label, excerpt, '12:55 PM')
    const reassessed = reassessCriterionWithDelta(
      attached,
      conflictCrit,
      excerpt,
      'Reconciled via consult note confirming compensated PBC.',
      '12:56 PM',
    )
    const delta = reassessed.findingsDeltas?.[conflictCrit.rule.label]
    expect(delta).toEqual({
      priorStatus: 'conflict',
      priorNote: conflictCrit.note,
      reassessedStatus: 'reassessed_met',
      attachedCount: 1,
      rationale: 'Reconciled via consult note confirming compensated PBC.',
      at: '12:56 PM',
    })
    expect(reassessed.overrides[conflictCrit.rule.label]).toContain('Reconciled via consult note')
    expect(reassessed.activity.at(-1)?.action).toContain('reassessed')
  })
})
