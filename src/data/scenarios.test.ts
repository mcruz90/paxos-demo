import { describe, it, expect } from 'vitest'
import { getCaseTier, getCaseStage, initialClients, scenarios } from './scenarios'
import type { Client } from '../types'

const byScenario = (id: string): Client => {
  const c = initialClients.find(x => x.scenarioId === id)
  if (!c) throw new Error(`no queue case for ${id}`)
  return c
}

describe('getCaseTier', () => {
  it('maps exception status to the exception tier', () => {
    expect(getCaseTier(byScenario('intercept-ocaliva'))).toBe('exception')
  })
  it('maps payer_response status to the complex tier', () => {
    expect(getCaseTier(byScenario('infant-omeprazole'))).toBe('complex')
  })
  it('treats ready_for_review as routine', () => {
    expect(getCaseTier(byScenario('novo-ozempic-initial'))).toBe('routine')
  })
})

describe('getCaseStage', () => {
  it('labels an initial_pa scenario as Initial PA', () => {
    expect(getCaseStage(byScenario('novo-ozempic-initial'))).toBe('Initial PA')
    expect(getCaseStage(byScenario('novo-ozempic-denied'))).toBe('Initial PA')
  })
  it('labels a non-initial scenario as Appeal', () => {
    expect(getCaseStage(byScenario('novo-ozempic'))).toBe('Appeal')
    expect(getCaseStage(byScenario('infant-omeprazole'))).toBe('Appeal')
  })
  it('derives stage from the scenario lifecycle, not the queue row', () => {
    expect(scenarios['novo-ozempic-initial'].lifecycle).toBe('initial_pa')
    expect(scenarios['novo-ozempic'].lifecycle).toBeUndefined()
  })
})
