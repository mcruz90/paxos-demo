import { describe, it, expect } from 'vitest'
import { buildPaRequest } from './paRequest'
import { scenarios } from '../../../data/scenarios'

describe('buildPaRequest', () => {
  it('maps an initial-PA scenario onto the wire request', () => {
    const scenario = scenarios['novo-ozempic-initial']
    const req = buildPaRequest(scenario)
    expect(req.scenario_id).toBe(scenario.id)
    expect(req.drug).toBe(scenario.drug)
    expect(req.plan_id).toBe(scenario.planId)
    expect(req.diagnosis).toBe(scenario.diagnosis)
    expect(req.requested_therapy).toBe(scenario.requestedTherapy)
    expect(req.attempt).toBe(1)
    expect(req.security_hold).toBe(false)
    // Confidences/status carry through — same fixture contract as the appeal path.
    expect(req.criteria_results.map(c => c.status)).toEqual(
      scenario.criteriaResults.map(c => c.status),
    )
  })

  it('lets the caller bump the attempt for a deliberate resubmission', () => {
    const req = buildPaRequest(scenarios['novo-ozempic-initial'], 2)
    expect(req.attempt).toBe(2)
  })
})
