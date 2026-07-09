import { describe, it, expect } from 'vitest'
import { dropResolved, shouldRefreshQueue } from './queue'
import type { PendingReviewItem, ResumeEvent } from '../../../lib/wire'

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
  it('refreshes after a successful resume', () => {
    expect(shouldRefreshQueue({ event: 'done', ref: 'r', correlation_id: 'a:1', tier: 'exception' } as unknown as ResumeEvent)).toBe(true)
  })

  it('does not refresh after a resume error', () => {
    expect(shouldRefreshQueue({ event: 'error', message: 'x', correlation_id: 'a:1' } as unknown as ResumeEvent)).toBe(false)
  })
})
