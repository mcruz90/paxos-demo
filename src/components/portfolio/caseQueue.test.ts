import { describe, it, expect } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import {
  EMPTY_LOCAL_CASE_STATE,
  type LocalCaseState,
  allExceptionsResolved,
  applyPayerDecision,
  countActionable,
  countLocallyResolved,
  filterClients,
  groupByAction,
  quickApproveClient,
  statusAfterResolution,
  unresolvedCriteria,
} from './caseQueue'

// Canonical demo fixtures — never duplicated ad hoc (CLAUDE.md DRY rule).
const clients = initialClients

describe('filterClients', () => {
  it('returns everything when no filters are active', () => {
    expect(filterClients(clients, '', 'all', 'all')).toHaveLength(clients.length)
  })
  it('matches patient display name case-insensitively', () => {
    const hits = filterClients(clients, 'margaret', 'all', 'all')
    expect(hits).toHaveLength(1)
    expect(hits[0].patientDisplayName).toBe('Margaret Vance')
  })
  it('matches payer name', () => {
    const hits = filterClients(clients, 'unitedhealthcare', 'all', 'all')
    expect(hits.every(c => c.payer === 'UnitedHealthcare')).toBe(true)
    expect(hits.length).toBeGreaterThan(0)
  })
  it('filters by lifecycle stage', () => {
    const initial = filterClients(clients, '', 'initial_pa', 'all')
    expect(initial.every(c => scenarios[c.scenarioId]?.lifecycle === 'initial_pa')).toBe(true)
    const appeals = filterClients(clients, '', 'appeal', 'all')
    expect(initial.length + appeals.length).toBe(clients.length)
  })
  it('filters by urgency', () => {
    const today = filterClients(clients, '', 'all', 'today')
    expect(today.every(c => c.urgency === 'today')).toBe(true)
  })
})

describe('groupByAction', () => {
  const groups = groupByAction(clients)

  it('drops empty groups and keeps every case exactly once', () => {
    expect(groups.every(g => g.rows.length > 0)).toBe(true)
    expect(groups.flatMap(g => g.rows)).toHaveLength(clients.length)
  })
  it('sorts each group most-urgent first', () => {
    const rank = { today: 0, soon: 1, later: 2 }
    for (const g of groups) {
      const ranks = g.rows.map(c => rank[c.urgency])
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
  })
  it('does not mutate the input order', () => {
    const before = clients.map(c => c.id)
    groupByAction(clients)
    expect(clients.map(c => c.id)).toEqual(before)
  })
})

describe('countActionable', () => {
  it('counts only statuses a coordinator can act on', () => {
    const expected = clients.filter(c =>
      ['ready_for_review', 'exception', 'payer_response'].includes(c.status)
    ).length
    expect(countActionable(clients)).toBe(expected)
  })
})

describe('exception resolution', () => {
  // gilead-livdelzi carries a conflict criterion in the canonical fixtures
  const scenario = scenarios['gilead-livdelzi']
  const unresolved = unresolvedCriteria(scenario)

  it('finds the unresolved criteria in a conflict scenario', () => {
    expect(unresolved.length).toBeGreaterThan(0)
    expect(unresolved.every(c => c.status !== 'found')).toBe(true)
  })

  it('counts dispatched and overridden criteria as resolved', () => {
    const local: LocalCaseState = {
      ...EMPTY_LOCAL_CASE_STATE,
      dispatched: [unresolved[0].rule.label],
      overrides: unresolved[1] ? { [unresolved[1].rule.label]: 'reviewed against discharge note' } : {},
    }
    expect(countLocallyResolved(unresolved, local)).toBe(Math.min(2, unresolved.length))
  })

  it('is fully resolved only when every unresolved criterion is handled', () => {
    expect(allExceptionsResolved(scenario, EMPTY_LOCAL_CASE_STATE)).toBe(false)
    const local: LocalCaseState = {
      ...EMPTY_LOCAL_CASE_STATE,
      overrides: Object.fromEntries(unresolved.map(c => [c.rule.label, 'rationale'])),
    }
    expect(allExceptionsResolved(scenario, local)).toBe(true)
  })

  it('a scenario with no exceptions is never "resolved"', () => {
    const clean = scenarios['novo-ozempic-initial']
    expect(unresolvedCriteria(clean)).toHaveLength(0)
    expect(allExceptionsResolved(clean, EMPTY_LOCAL_CASE_STATE)).toBe(false)
  })

  it('routes to awaiting_documentation when a workflow was dispatched, else ready_for_review', () => {
    expect(statusAfterResolution({ ...EMPTY_LOCAL_CASE_STATE, dispatched: ['x'] })).toBe('awaiting_documentation')
    // Override-only resolution still goes through the human approval gate —
    // it never jumps straight to submitted (05-state-lifecycle).
    expect(statusAfterResolution(EMPTY_LOCAL_CASE_STATE)).toBe('ready_for_review')
  })
})

describe('status transitions', () => {
  const reviewCase = clients.find(c => c.status === 'ready_for_review')!
  const payerCase  = clients.find(c => c.status === 'payer_response')!

  it('quick-approve submits a ready_for_review case', () => {
    const next = quickApproveClient(clients, reviewCase.scenarioId)
    expect(next.find(c => c.id === reviewCase.id)?.status).toBe('submitted')
  })
  it('quick-approve is a no-op on a case not ready for review', () => {
    const next = quickApproveClient(clients, payerCase.scenarioId)
    expect(next.find(c => c.id === payerCase.id)?.status).toBe('payer_response')
  })
  it('accepting a payer offer submits; disputing returns to review', () => {
    const accepted = applyPayerDecision(clients, payerCase.scenarioId, 'accepted')
    expect(accepted.find(c => c.id === payerCase.id)?.status).toBe('submitted')
    const disputed = applyPayerDecision(clients, payerCase.scenarioId, 'disputed')
    expect(disputed.find(c => c.id === payerCase.id)?.status).toBe('ready_for_review')
  })
  it('never mutates the input array', () => {
    const before = clients.map(c => c.status)
    quickApproveClient(clients, reviewCase.scenarioId)
    expect(clients.map(c => c.status)).toEqual(before)
  })
})
