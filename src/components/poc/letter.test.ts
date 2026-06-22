import { describe, it, expect } from 'vitest'
import { buildLetterBody, buildPaRequestNarrative } from './letter'
import { scenarios } from '../../data/scenarios'

describe('buildLetterBody (appeal)', () => {
  const body = buildLetterBody(scenarios['novo-ozempic'])

  it('addresses the medical director and names the drug', () => {
    expect(body).toContain('Dear Medical Director')
    expect(body).toContain(scenarios['novo-ozempic'].drug)
  })
  it('quotes the denial reason it is contesting', () => {
    expect(body).toContain(scenarios['novo-ozempic'].denialReason)
  })
  it('lists each criterion from the scenario', () => {
    for (const cr of scenarios['novo-ozempic'].criteriaResults) {
      expect(body).toContain(cr.rule.label)
    }
  })
})

describe('buildPaRequestNarrative (initial PA)', () => {
  const sc = scenarios['novo-ozempic-initial']
  const narrative = buildPaRequestNarrative(sc)

  it('requests prior authorization for the requested therapy + diagnosis', () => {
    expect(narrative.toLowerCase()).toContain('prior authorization')
    expect(narrative).toContain(sc.requestedTherapy as string)
    expect(narrative).toContain(sc.diagnosis)
  })
})
