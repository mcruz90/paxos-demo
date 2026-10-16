import { describe, it, expect } from 'vitest'
import { reduceAppealEvent, initialGenState, isParked, resolutionNote, type LiveGenState } from './appealEvents'
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
    expect(state.done?.ref).toBe('abc')
    expect(state.done?.tier).toBe('routine')
    expect(state.error).toBeNull()
  })

  it('marks the exception tier as parked and awaiting review', () => {
    const state = fold([
      { event: 'chunk', text: 'draft' } as AppealEvent,
      { event: 'done', ref: 'r', correlation_id: 'case:a1', tier: 'exception' } as unknown as AppealEvent,
    ])
    expect(isParked(state)).toBe(true)
    expect(state.correlationId).toBe('case:a1')
    expect(state.done?.tier).toBe('exception')
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

describe('resolutionNote', () => {
  it('flags the generic fallback', () => {
    expect(resolutionNote('generic')).toEqual({ warn: true, text: 'Generic-fallback letter (no plan-specific policy matched)' })
  })

  it('flags a drug-name-only match as no policy for this plan, never a policy match', () => {
    const note = resolutionNote('drug_alias')
    expect(note?.warn).toBe(true)
    expect(note?.text).toBe("No policy on file for this plan — another plan's criteria not used; needs a person")
  })

  it('shows a plan match plainly', () => {
    expect(resolutionNote('plan_id')).toEqual({ warn: false, text: 'Policy match plan_id' })
  })

  it('shows nothing before retrieval', () => {
    expect(resolutionNote('')).toBeNull()
  })
})
