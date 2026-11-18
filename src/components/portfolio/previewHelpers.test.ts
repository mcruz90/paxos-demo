import { describe, expect, it } from 'vitest'
import { patientProfiles } from '../../data/patients'
import { scenarios } from '../../data/scenarios'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import { buildQaSuggestions, sortCriteriaForReview } from './previewHelpers'

describe('sortCriteriaForReview', () => {
  const livdelzi = scenarios['gilead-livdelzi']

  it('sorts open conflicts before needs_review before satisfied while preserving origIdx', () => {
    const sorted = sortCriteriaForReview(livdelzi.criteriaResults, EMPTY_LOCAL_CASE_STATE)
    expect(sorted).toHaveLength(livdelzi.criteriaResults.length)
    expect(sorted[0].criterion.status).toBe('conflict')
    expect(sorted[0].origIdx).not.toBeUndefined()
    const statuses = sorted.map(x => x.criterion.status)
    const firstFoundIdx = statuses.indexOf('found')
    const lastOpenIdx = Math.max(statuses.lastIndexOf('conflict'), statuses.lastIndexOf('needs_review'))
    expect(lastOpenIdx).toBeLessThan(firstFoundIdx)
  })

  it('moves locally overridden or dispatched criteria behind unresolved ones', () => {
    const conflict = livdelzi.criteriaResults.find(c => c.status === 'conflict')!
    const state = {
      ...EMPTY_LOCAL_CASE_STATE,
      overrides: { [conflict.rule.label]: 'reconciled locally' },
    }
    const sorted = sortCriteriaForReview(livdelzi.criteriaResults, state)
    expect(sorted[0].criterion.status).toBe('needs_review')
  })
})

describe('buildQaSuggestions', () => {
  it('builds grounded Q&A prompts from scenario citations and optional patient profile', () => {
    const ozempic = scenarios['novo-ozempic']
    const suggestions = buildQaSuggestions(ozempic, patientProfiles['PT-3102'])
    expect(suggestions.length).toBeGreaterThanOrEqual(2)
    expect(suggestions.some(s => s.q.includes('prior therapy'))).toBe(true)

    const humira = scenarios['humira-cigna']
    const noProfileSuggestions = buildQaSuggestions(humira, undefined)
    expect(noProfileSuggestions.length).toBeGreaterThanOrEqual(1)
  })
})
