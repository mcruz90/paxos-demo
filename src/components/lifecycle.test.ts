import { describe, it, expect } from 'vitest'
import { computeSkeletonDeltas, LIFECYCLE_SKELETON_V1, type LifecycleStage } from './LifecycleSkeleton'

const clone = (): typeof LIFECYCLE_SKELETON_V1 => JSON.parse(JSON.stringify(LIFECYCLE_SKELETON_V1))

describe('computeSkeletonDeltas', () => {
  it('reports no changes for an identical skeleton', () => {
    expect(computeSkeletonDeltas(LIFECYCLE_SKELETON_V1, clone())).toEqual(['No changes'])
  })

  it('detects an inserted stage', () => {
    const next = clone()
    const newStage: LifecycleStage = { key: 'x', name: 'Reauthorization', node: 'Routing', role: '', gates: [], fields: [] }
    next.stages.push(newStage)
    const deltas = computeSkeletonDeltas(LIFECYCLE_SKELETON_V1, next)
    expect(deltas).toContain('+ stage: "Reauthorization"')
  })

  it('detects an edited stage (gate added) as a change', () => {
    const next = clone()
    next.stages[0] = { ...next.stages[0], gates: [...next.stages[0].gates, 'New gate'] }
    const deltas = computeSkeletonDeltas(LIFECYCLE_SKELETON_V1, next)
    expect(deltas[0]).not.toBe('No changes')
    expect(deltas.length).toBeGreaterThan(0)
  })

  it('seeds the full lifecycle (intake through appeal)', () => {
    const keys = LIFECYCLE_SKELETON_V1.stages.map(s => s.key)
    expect(keys).toContain('intake')
    expect(keys).toContain('determination')
    expect(keys).toContain('appeal')
  })
})
