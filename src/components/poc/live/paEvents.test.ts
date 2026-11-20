import { describe, it, expect } from 'vitest'
import { reducePaEvent, initialPaState, crdVerdictLabel, type LivePaState } from './paEvents'
import type { PaSubmitEvent } from '../../../lib/wire'

const fold = (events: PaSubmitEvent[]): LivePaState => events.reduce(reducePaEvent, initialPaState)

describe('reducePaEvent', () => {
  it('accumulates steps then captures the required-PA determination terminal', () => {
    const state = fold([
      { event: 'step', step: 'crd', label: 'CRD pre-check' } as PaSubmitEvent,
      { event: 'step', step: 'assemble', label: 'Assembling PAS bundle' } as PaSubmitEvent,
      {
        event: 'done',
        pa_required: { required: true, basis: 'PA required' },
        outcome: { decision: 'approved', determinationId: 'AUTH-1', note: 'ok', timeToTherapy: '2 days' },
        appeal_handoff: null,
        submission_ref: 'PAS-123',
        pa_resolution: 'plan_id',
        correlation_id: 'case:a1',
      } as unknown as PaSubmitEvent,
    ])
    expect(state.status).toBe('done')
    expect(state.steps.map(s => s.step)).toEqual(['crd', 'assemble'])
    expect(state.paRequired?.required).toBe(true)
    expect(state.outcome?.decision).toBe('approved')
    expect(state.submissionRef).toBe('PAS-123')
    expect(state.appealHandoff).toBeNull()
    expect(state.correlationId).toBe('case:a1')
    expect(state.error).toBeNull()
  })

  it('carries the appeal handoff on a denied determination', () => {
    const state = fold([
      {
        event: 'done',
        pa_required: { required: true, basis: 'PA required' },
        outcome: { decision: 'denied', determinationId: 'AUTH-2', note: 'no', timeToTherapy: '' },
        appeal_handoff: { scenarioId: 'novo-ozempic', caseRef: 'CASE-9' },
        submission_ref: 'PAS-9',
        pa_resolution: 'plan_id',
        correlation_id: 'case:a1',
      } as unknown as PaSubmitEvent,
    ])
    expect(state.outcome?.decision).toBe('denied')
    expect(state.appealHandoff?.scenarioId).toBe('novo-ozempic')
  })

  it('folds an in-stream error into the error status with its message', () => {
    const state = fold([{ event: 'error', message: 'boom', correlation_id: 'case:a1' } as unknown as PaSubmitEvent])
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
    expect(state.correlationId).toBe('case:a1')
  })
})

describe('crdVerdictLabel', () => {
  it('labels a required PA', () => {
    expect(crdVerdictLabel(true)).toBe('PA required')
  })

  it('labels a source-backed "not required" as the early exit', () => {
    expect(crdVerdictLabel(false)).toBe('PA not required — CRD early exit')
  })

  it('labels an unknown verdict (registry miss) for a person, never "not required"', () => {
    const label = crdVerdictLabel(null)
    expect(label).toBe('Unknown — needs review by a person')
    expect(label).not.toMatch(/not required/i)
  })
})
