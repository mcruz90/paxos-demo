/**
 * Pure event→UI-state reducer for the live appeal-generate stream.
 *
 * `streamAppealGenerate` yields a `step` / `chunk` / `done` / `error` union
 * (06-api-contract.md); this folds that sequence into the flat `LiveGenState`
 * the live POC view renders. Kept pure (no React, no I/O) so the mapping is
 * unit-tested with literal event sequences — the hook (useLiveAppeal) only
 * drives the async iteration and calls this per event.
 *
 * The contract guarantees exactly one terminal (`done`/`error`) event and
 * valid JSON per frame, so there is no defensive handling for out-of-order or
 * malformed events (STYLE MANDATE: no branching for contract-ruled-out states).
 */
import type { AppealEvent, DoneEvent } from '../../../lib/wire'

export type LiveGenStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface LiveStep {
  step: string
  label: string
}

export interface LiveGenState {
  status: LiveGenStatus
  /** Pipeline steps seen so far, in arrival order. */
  steps: LiveStep[]
  /** Accumulated letter text from `chunk` events. */
  letter: string
  /** Resume handle from the terminal `done` event (null until then). */
  correlationId: string | null
  /** HITL tier from `done`; `exception` means the run parked for review. */
  tier: DoneEvent['tier']
  /** Whole terminal `done` payload (model, ref, scores, pa_resolution…) so the
   * done panel renders everything the backend returned; null until `done`. */
  done: DoneEvent | null
  /** Client-facing message from a terminal `error` event. */
  error: string | null
}

export const initialGenState: LiveGenState = {
  status: 'idle',
  steps: [],
  letter: '',
  correlationId: null,
  tier: null,
  done: null,
  error: null,
}

export function reduceAppealEvent(state: LiveGenState, event: AppealEvent): LiveGenState {
  switch (event.event) {
    case 'step':
      return { ...state, status: 'streaming', steps: [...state.steps, { step: event.step, label: event.label }] }
    case 'chunk':
      return { ...state, status: 'streaming', letter: state.letter + event.text }
    case 'done':
      return { ...state, status: 'done', correlationId: event.correlation_id, tier: event.tier, done: event }
    case 'error':
      return { ...state, status: 'error', error: event.message, correlationId: event.correlation_id }
  }
}

/** True once the run parked at the exception tier and is awaiting review. */
export function isParked(state: LiveGenState): boolean {
  return state.status === 'done' && state.tier === 'exception'
}

/**
 * The done panel's note on which policy produced the letter. Only a plan_id
 * hit is a policy match: "drug_alias" means the drug has a pack under another
 * plan, whose criteria are not used, so a person decides (ADR-0019).
 */
export function resolutionNote(resolution: DoneEvent['pa_resolution']): { warn: boolean; text: string } | null {
  if (!resolution) return null
  if (resolution === 'generic') return { warn: true, text: 'Generic-fallback letter (no plan-specific policy matched)' }
  if (resolution === 'drug_alias') {
    return { warn: true, text: "No policy on file for this plan — another plan's criteria not used; needs a person" }
  }
  return { warn: false, text: `Policy match ${resolution}` }
}
