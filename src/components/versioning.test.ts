import { describe, it, expect } from 'vitest'
import { diffList, dimStatus, dimFails, verdictOf, type DimResult } from './versioning'
import { thresholdLabel } from '../data/evalRubric'

describe('diffList', () => {
  const fmt = (x: { k: string }) => x.k
  it('reports additions with a + prefix', () => {
    const out = diffList([{ k: 'a' }], [{ k: 'a' }, { k: 'b' }], 'rule', fmt)
    expect(out).toEqual(['+ rule: "b"'])
  })
  it('reports removals (not as additions)', () => {
    const out = diffList([{ k: 'a' }, { k: 'b' }], [{ k: 'a' }], 'rule', fmt)
    expect(out).toHaveLength(1)
    expect(out[0]).toContain('rule: "b"')
    expect(out[0]).not.toContain('+')
  })
  it('returns nothing when the lists match', () => {
    expect(diffList([{ k: 'a' }], [{ k: 'a' }], 'rule', fmt)).toEqual([])
  })
})

describe('thresholdLabel', () => {
  it('shows 100% for a hard gate and ≥ N% otherwise', () => {
    expect(thresholdLabel(1)).toBe('100%')
    expect(thresholdLabel(0.85)).toBe('≥ 85%')
  })
})

const dim = (over: Partial<DimResult>): DimResult =>
  ({ dim: 'X', base: 90, candidate: 90, threshold: 90, lowerIsBetter: false, ...over })

describe('dimStatus / dimFails / verdictOf', () => {
  it('classifies improved / held / regressed by direction', () => {
    expect(dimStatus(dim({ candidate: 94 }))).toBe('improved')
    expect(dimStatus(dim({ candidate: 90 }))).toBe('held')
    expect(dimStatus(dim({ candidate: 85 }))).toBe('regressed')
    // lowerIsBetter flips the direction
    expect(dimStatus(dim({ base: 4, candidate: 2, threshold: 5, lowerIsBetter: true }))).toBe('improved')
  })
  it('fails a dimension that crosses its threshold', () => {
    expect(dimFails(dim({ candidate: 80, threshold: 90 }))).toBe(true)
    expect(dimFails(dim({ candidate: 95, threshold: 90 }))).toBe(false)
    expect(dimFails(dim({ base: 4, candidate: 7, threshold: 5, lowerIsBetter: true }))).toBe(true)
  })
  it('blocks the verdict if any dimension fails, else clean', () => {
    expect(verdictOf([dim({}), dim({ candidate: 95 })])).toBe('clean')
    expect(verdictOf([dim({}), dim({ candidate: 80, threshold: 90 })])).toBe('blocked')
  })
})
