import { describe, it, expect } from 'vitest'
import { buildAppealRequest } from './appealRequest'
import { scenarios } from '../../../data/scenarios'

describe('buildAppealRequest', () => {
  it('maps a scenario onto the wire request, carrying confidences through verbatim', () => {
    const scenario = scenarios['pediatric-esomeprazole']
    const req = buildAppealRequest(scenario)
    expect(req.scenario_id).toBe(scenario.id)
    expect(req.drug).toBe(scenario.drug)
    expect(req.plan_id).toBe(scenario.planId)
    expect(req.diagnosis).toBe(scenario.diagnosis)
    expect(req.attempt).toBe(1)
    expect(req.security_hold).toBe(false)
    // Confidences drive the backend tier decision — must survive the mapping.
    expect(req.criteria_results.map(c => c.confidence)).toEqual(
      scenario.criteriaResults.map(c => c.confidence),
    )
  })

  it('lets the caller bump the attempt for a deliberate resubmission', () => {
    const req = buildAppealRequest(scenarios['novo-ozempic'], 3)
    expect(req.attempt).toBe(3)
  })

  // SU slice 2: the portfolio case workspace feeds its `activeScenario`
  // (a full ScenarioConfig) straight into buildAppealRequest — no adapter. This
  // pins the wiring for a ready_for_review portfolio fixture (novo-ozempic),
  // proving the required wire fields are all present so LiveLetterGeneration can
  // drive useLiveAppeal.run(scenario) directly.
  it('builds a valid request from a ready_for_review portfolio scenario', () => {
    const req = buildAppealRequest(scenarios['novo-ozempic'])
    expect(req.scenario_id).toBeTruthy()
    expect(req.drug).toBeTruthy()
    expect(req.plan_id).toBeTruthy()
    expect(req.diagnosis).toBeTruthy()
    expect(req.denial_text).toBeTruthy()
    expect(req.attempt).toBe(1)
    expect(req.security_hold).toBe(false)
    expect(Array.isArray(req.criteria_results)).toBe(true)
    expect(req.tenant_id).toBe('tenant_demo')
  })
})
