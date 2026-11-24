import { describe, it, expect } from 'vitest'
import { getPipelineSteps } from './pipeline'
import { scenarios } from '../../data/scenarios'

const labels = ['Ingestion', 'Retrieval', 'Synthesis', 'Gatekeeper']

describe('getPipelineSteps', () => {
  it('always returns the four DAG nodes in order', () => {
    for (const id of Object.keys(scenarios)) {
      const steps = getPipelineSteps(scenarios[id])
      expect(steps.map(s => s.label)).toEqual(labels)
      for (const s of steps) {
        expect(s.loadingText.length).toBeGreaterThan(0)
        expect(s.explanation.length).toBeGreaterThan(0)
      }
    }
  })

  it('uses the Da Vinci CRD/DTR framing for an initial PA', () => {
    const steps = getPipelineSteps(scenarios['novo-ozempic-initial'])
    expect(steps[0].explanation).toContain('CRD')
    expect(steps[1].explanation).toContain('DTR')
    expect(steps[3].explanation).toContain('PAS')
  })

  it('uses appeal framing (indication clarification) for the Ozempic appeal', () => {
    const steps = getPipelineSteps(scenarios['novo-ozempic'])
    expect(steps[0].explanation.toLowerCase()).toContain('indication')
    expect(steps[0].explanation).not.toContain('CRD')
  })

  it('uses the pediatric PPI duration partial-approval and dysphagia framing', () => {
    const steps = getPipelineSteps(scenarios['pediatric-esomeprazole'])
    expect(steps[1].explanation.toLowerCase()).toContain('dysphagia')
    const combined = steps.map(s => s.explanation).join(' ')
    expect(combined).toContain('28 of 56')
    expect(combined).toContain('56-day')
    expect(combined).toContain('12 months')
    expect(combined.toLowerCase()).toContain('partial approval')
    expect(combined).not.toMatch(/step-therapy denial/i)
    expect(combined).not.toMatch(/step-therapy exception/i)
    expect(combined).not.toMatch(/NASPGHAN/i)
    expect(combined).not.toMatch(/29470322/)
  })
})
