import { describe, it, expect } from 'vitest'
import { NODE_META, isNodeEditable } from './instructions'

// The Agent Instructions view must NOT present the gatekeeper as an editable
// LLM prompt: ADR-0003 makes the gatekeeper a deterministic code validator,
// never an LLM. Only LLM-backed nodes carry an editable prompt; the gatekeeper
// renders read-only with no prompt-edit affordance. This predicate is the seam
// the view uses to gate the Edit control.
describe('isNodeEditable — gatekeeper is a deterministic validator, not an editable prompt (ADR-0003)', () => {
  const byId = (id: string) => NODE_META.find(n => n.id === id)!

  it('marks the deterministic gatekeeper node as NOT editable', () => {
    const gatekeeper = byId('gatekeeper')
    expect(gatekeeper.deterministic).toBe(true)
    expect(isNodeEditable(gatekeeper)).toBe(false)
  })

  it('keeps the LLM-backed nodes editable', () => {
    expect(isNodeEditable(byId('ingestion'))).toBe(true)
    expect(isNodeEditable(byId('retrieval'))).toBe(true)
    expect(isNodeEditable(byId('synthesis'))).toBe(true)
  })

  it('gates strictly on the deterministic flag', () => {
    expect(isNodeEditable({ deterministic: true })).toBe(false)
    expect(isNodeEditable({ deterministic: false })).toBe(true)
    expect(isNodeEditable({})).toBe(true)
  })
})
