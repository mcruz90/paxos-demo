import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import { EMPTY_LOCAL_CASE_STATE, unresolvedCriteria } from './caseQueue'
import { resolveExplicitCaseTransition } from './exceptionStatusTransition'

describe('resolveExplicitCaseTransition (A11)', () => {
  const scenario = scenarios['gilead-livdelzi']
  const unresolved = unresolvedCriteria(scenario)

  it('returns null when unresolved exceptions remain', () => {
    expect(resolveExplicitCaseTransition('exception', scenario, EMPTY_LOCAL_CASE_STATE)).toBeNull()
  })

  it('returns null when the case is no longer in exception status', () => {
    const resolvedByOverride = {
      ...EMPTY_LOCAL_CASE_STATE,
      overrides: Object.fromEntries(unresolved.map(c => [c.rule.label, 'documented rationale'])),
    }
    expect(resolveExplicitCaseTransition('ready_for_review', scenario, resolvedByOverride)).toBeNull()
    expect(resolveExplicitCaseTransition('awaiting_documentation', scenario, resolvedByOverride)).toBeNull()
    expect(resolveExplicitCaseTransition('submitted', scenario, resolvedByOverride)).toBeNull()
  })

  it('returns an explicit Move to Awaiting Documentation action when a query was dispatched', () => {
    const resolvedWithDispatch = {
      ...EMPTY_LOCAL_CASE_STATE,
      dispatched: [unresolved[0].rule.label],
      overrides: Object.fromEntries(unresolved.slice(1).map(c => [c.rule.label, 'reviewed'])),
    }
    expect(resolveExplicitCaseTransition('exception', scenario, resolvedWithDispatch)).toEqual({
      nextStatus: 'awaiting_documentation',
      actionLabel: 'Move to Awaiting Documentation',
      summary: 'All exceptions addressed locally. Confirm moving this case to Awaiting Documentation.',
    })
  })

  it('returns an explicit Move to Ready for Review action when all exceptions are overridden', () => {
    const resolvedByOverride = {
      ...EMPTY_LOCAL_CASE_STATE,
      overrides: Object.fromEntries(unresolved.map(c => [c.rule.label, 'reviewed against chart'])),
    }
    expect(resolveExplicitCaseTransition('exception', scenario, resolvedByOverride)).toEqual({
      nextStatus: 'ready_for_review',
      actionLabel: 'Move to Ready for Review',
      summary: 'All exceptions addressed locally. Confirm moving this case to Ready for Review.',
    })
  })
})
