/**
 * Pure event→UI-state reducer for the live initial-PA stream.
 *
 * `streamPaSubmit` yields a `step` / `done` / `error` union (the initial-PA path
 * has no LLM, so never `chunk`); this folds it into the flat `LivePaState` the
 * PaResultView renders. Same contract guarantees as the appeal reducer — exactly
 * one terminal, valid JSON per frame — so no defensive branching (STYLE MANDATE).
 */
import type { PaSubmitEvent, InitialPaDoneEvent } from '../../../lib/wire'
import type { LiveStep } from './appealEvents'

export type LivePaStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface LivePaState {
  status: LivePaStatus
  steps: LiveStep[]
  /** CRD pre-check verdict (present on `done`). */
  paRequired: InitialPaDoneEvent['pa_required'] | null
  /** Payer determination; null when the CRD early-exits (not required, or unknown). */
  outcome: InitialPaDoneEvent['outcome']
  /** Appeal pointer, present iff the determination is denied. */
  appealHandoff: InitialPaDoneEvent['appeal_handoff']
  submissionRef: string
  paResolution: InitialPaDoneEvent['pa_resolution'] | ''
  correlationId: string | null
  error: string | null
}

export const initialPaState: LivePaState = {
  status: 'idle',
  steps: [],
  paRequired: null,
  outcome: null,
  appealHandoff: null,
  submissionRef: '',
  paResolution: '',
  correlationId: null,
  error: null,
}

export function reducePaEvent(state: LivePaState, event: PaSubmitEvent): LivePaState {
  switch (event.event) {
    case 'step':
      return { ...state, status: 'streaming', steps: [...state.steps, { step: event.step, label: event.label }] }
    case 'done':
      return {
        ...state,
        status: 'done',
        paRequired: event.pa_required,
        outcome: event.outcome,
        appealHandoff: event.appeal_handoff,
        submissionRef: event.submission_ref,
        paResolution: event.pa_resolution,
        correlationId: event.correlation_id,
      }
    case 'error':
      return { ...state, status: 'error', error: event.message, correlationId: event.correlation_id }
  }
}

/**
 * Headline for the CRD verdict. `null` = unknown (a registry miss): a person
 * decides, so it must never read as "PA not required" (ADR-0018).
 */
export function crdVerdictLabel(required: boolean | null): string {
  if (required === null) return 'Unknown — needs review by a person'
  return required ? 'PA required' : 'PA not required — CRD early exit'
}
