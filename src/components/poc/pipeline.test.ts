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

  it('uses the pediatric PPI step-therapy / dysphagia framing', () => {
    const steps = getPipelineSteps(scenarios['pediatric-esomeprazole'])
    expect(steps[1].explanation.toLowerCase()).toContain('dysphagia')
  })
})
