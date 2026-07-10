import { describe, it, expect } from 'vitest'
import { dropResolved, shouldRefreshQueue } from './queue'
import { initialGenState, type LiveGenState } from './appealEvents'
import type { PendingReviewItem } from '../../../lib/wire'

const item = (correlation_id: string): PendingReviewItem => ({
  correlation_id,
  scenario_id: 's',
  drug: 'd',
  plan: 'p',
  parked_at: '2026-07-08T00:00:00Z',
  tier: 'exception',
})

describe('dropResolved', () => {
  it('removes only the resumed run from the snapshot', () => {
    const reviews = [item('a:1'), item('b:1'), item('c:1')]
    expect(dropResolved(reviews, 'b:1').map(r => r.correlation_id)).toEqual(['a:1', 'c:1'])
  })

  it('is a no-op when the id is absent', () => {
    const reviews = [item('a:1')]
    expect(dropResolved(reviews, 'z:1')).toEqual(reviews)
  })
})

describe('shouldRefreshQueue', () => {
  const doneState: LiveGenState = { ...initialGenState, status: 'done', correlationId: 'a:1', tier: 'exception' }
  const errorState: LiveGenState = { ...initialGenState, status: 'error', error: 'No appeal is awaiting human review', correlationId: 'a:1' }

  it('refreshes after a resume that reached a done terminal', () => {
    expect(shouldRefreshQueue(doneState)).toBe(true)
  })

  it('does not refresh after a resume that ended in an error terminal', () => {
    expect(shouldRefreshQueue(errorState)).toBe(false)
  })

  it('does not refresh a still-streaming or idle state', () => {
    expect(shouldRefreshQueue(initialGenState)).toBe(false)
    expect(shouldRefreshQueue({ ...initialGenState, status: 'streaming' })).toBe(false)
  })
})
