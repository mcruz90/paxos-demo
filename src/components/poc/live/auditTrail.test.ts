import { describe, it, expect } from 'vitest'
import { sortAuditNewestFirst } from './auditTrail'
import type { AuditRecord } from '../../../lib/wire'

const rec = (correlation_id: string, timestamp: string): AuditRecord =>
  ({ correlation_id, timestamp } as unknown as AuditRecord)

describe('sortAuditNewestFirst', () => {
  it('orders records by timestamp descending without mutating the input', () => {
    const input = [
      rec('a', '2026-07-10T08:00:00Z'),
      rec('b', '2026-07-12T09:30:00Z'),
      rec('c', '2026-07-11T12:00:00Z'),
    ]
    const sorted = sortAuditNewestFirst(input)
    expect(sorted.map(r => r.correlation_id)).toEqual(['b', 'c', 'a'])
    // Pure — the caller's array order is untouched.
    expect(input.map(r => r.correlation_id)).toEqual(['a', 'b', 'c'])
  })
})
