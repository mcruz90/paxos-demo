import { describe, expect, it } from 'vitest'
import { patientProfiles } from '../../data/patients'
import { scenarios } from '../../data/scenarios'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import {
  buildQaSuggestions,
  classifyCriterionTaxonomy,
  derivePathwayBranch,
  sortCriteriaForReview,
} from './previewHelpers'

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

describe('classifyCriterionTaxonomy', () => {
  const livdelzi = scenarios['gilead-livdelzi']
  const humira = scenarios['humira-cigna']
  const ozempicDocGap = scenarios['novo-ozempic-docgap']

  it('distinguishes conflict, exception_possible, records_needed, not_documented, met, and reassessed_met', () => {
    const conflict = livdelzi.criteriaResults.find(c => c.status === 'conflict')!
    expect(classifyCriterionTaxonomy(conflict, EMPTY_LOCAL_CASE_STATE).code).toBe('conflict')

    const humiraEx = humira.criteriaResults.find(c => c.status === 'needs_review')!
    expect(classifyCriterionTaxonomy(humiraEx, EMPTY_LOCAL_CASE_STATE).code).toBe('exception_possible')

    const docGap = ozempicDocGap.criteriaResults.find(c => c.status === 'needs_review')!
    expect(classifyCriterionTaxonomy(docGap, EMPTY_LOCAL_CASE_STATE).code).toBe('records_needed')

    const spec = livdelzi.criteriaResults.find(c => c.status === 'needs_review')!
    expect(classifyCriterionTaxonomy(spec, EMPTY_LOCAL_CASE_STATE).code).toBe('records_needed')

    const foundCrit = livdelzi.criteriaResults.find(c => c.status === 'found')!
    expect(classifyCriterionTaxonomy(foundCrit, EMPTY_LOCAL_CASE_STATE).code).toBe('met')

    const withOverride = { ...EMPTY_LOCAL_CASE_STATE, overrides: { [conflict.rule.label]: 'reconciled' } }
    expect(classifyCriterionTaxonomy(conflict, withOverride).code).toBe('reassessed_met')
  })
})

describe('derivePathwayBranch', () => {
  const livdelzi = scenarios['gilead-livdelzi']
  const esomeprazole = scenarios['pediatric-esomeprazole']

  it('identifies MANDATORY GATE, OR / BYPASS, >=2 OF 3, and ALL OF branches', () => {
    const conflict = livdelzi.criteriaResults.find(c => c.rule.type === 'safety')!
    expect(derivePathwayBranch(conflict).operator).toBe('MANDATORY GATE')

    const pbcDx = livdelzi.criteriaResults.find(c => c.rule.label.includes('≥2 of 3'))!
    expect(derivePathwayBranch(pbcDx).operator).toBe('≥2 OF 3')

    const bypass = esomeprazole.criteriaResults.find(c => c.rule.label.includes('Bypass'))!
    expect(derivePathwayBranch(bypass).operator).toBe('OR / BYPASS')

    const mandatory = livdelzi.criteriaResults.find(c => c.rule.label.includes('Specialist Prescriber'))!
    expect(derivePathwayBranch(mandatory).operator).toBe('ALL OF')
  })
})
