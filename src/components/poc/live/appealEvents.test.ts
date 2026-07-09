import { describe, it, expect } from 'vitest'
import { reduceAppealEvent, initialGenState, isParked, type LiveGenState } from './appealEvents'
import type { AppealEvent } from '../../../lib/wire'

const fold = (events: AppealEvent[]): LiveGenState => events.reduce(reduceAppealEvent, initialGenState)

describe('reduceAppealEvent', () => {
  it('accumulates steps and chunked letter text, then captures the done handle', () => {
    const state = fold([
      { event: 'step', step: 'ingestion', label: 'Reading record' } as AppealEvent,
      { event: 'step', step: 'draft', label: 'Drafting' } as AppealEvent,
      { event: 'chunk', text: 'Dear ' } as AppealEvent,
      { event: 'chunk', text: 'Reviewer' } as AppealEvent,
      { event: 'done', event_: undefined, ref: 'abc', correlation_id: 'case:a1', tier: 'routine' } as unknown as AppealEvent,
    ])
    expect(state.status).toBe('done')
    expect(state.steps.map(s => s.step)).toEqual(['ingestion', 'draft'])
    expect(state.letter).toBe('Dear Reviewer')
    expect(state.correlationId).toBe('case:a1')
    expect(state.tier).toBe('routine')
    expect(state.error).toBeNull()
  })

  it('marks the exception tier as parked and awaiting review', () => {
    const state = fold([
      { event: 'chunk', text: 'draft' } as AppealEvent,
      { event: 'done', ref: 'r', correlation_id: 'case:a1', tier: 'exception' } as unknown as AppealEvent,
    ])
    expect(isParked(state)).toBe(true)
    expect(state.correlationId).toBe('case:a1')
  })

  it('does not treat a routine terminal as parked', () => {
    const state = fold([{ event: 'done', ref: 'r', correlation_id: 'c', tier: 'routine' } as unknown as AppealEvent])
    expect(isParked(state)).toBe(false)
  })

  it('folds an in-stream error into the error status with its message', () => {
    const state = fold([{ event: 'error', message: 'boom', correlation_id: 'case:a1' } as unknown as AppealEvent])
    expect(state.status).toBe('error')
    expect(state.error).toBe('boom')
    expect(state.correlationId).toBe('case:a1')
  })
})
