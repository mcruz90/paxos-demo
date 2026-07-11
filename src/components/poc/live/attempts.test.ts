import { describe, it, expect } from 'vitest'
import { nextAttempt, type AttemptMap } from './attempts'

describe('nextAttempt', () => {
  it('starts a scenario at attempt 1', () => {
    const attempts: AttemptMap = new Map()
    expect(nextAttempt(attempts, 'pediatric-esomeprazole')).toBe(1)
  })

  it('bumps the attempt on every regenerate of the same scenario', () => {
    const attempts: AttemptMap = new Map()
    expect(nextAttempt(attempts, 'pediatric-esomeprazole')).toBe(1)
    expect(nextAttempt(attempts, 'pediatric-esomeprazole')).toBe(2)
    expect(nextAttempt(attempts, 'pediatric-esomeprazole')).toBe(3)
  })

  it('tracks each scenario independently — a new scenario starts at 1', () => {
    const attempts: AttemptMap = new Map()
    nextAttempt(attempts, 'pediatric-esomeprazole')
    nextAttempt(attempts, 'pediatric-esomeprazole')
    expect(nextAttempt(attempts, 'novo-ozempic')).toBe(1)
    // The first scenario's counter is unaffected by the second.
    expect(nextAttempt(attempts, 'pediatric-esomeprazole')).toBe(3)
  })
})
