/**
 * Drives the live initial-PA submit SSE stream into `LivePaState`.
 *
 * Mirror of useLiveAppeal: the async iteration lives here, the fold is the pure
 * `reducePaEvent`. A 401 mid-stream calls `onExpire`; any other thrown error
 * lands as an `error` terminal so the UI leaves the spinner. Shares the same
 * per-scenario attempt tracker (attempts.ts) so re-running a case isn't deduped
 * by the backend idempotency key (case_id + attempt, ADR-0009).
 */
import { useCallback, useRef, useState } from 'react'
import { ApiError, streamPaSubmit } from '../../../lib/api'
import type { ScenarioConfig } from '../../../types'
import { buildPaRequest } from './paRequest'
import { nextAttempt, type AttemptMap } from './attempts'
import { initialPaState, reducePaEvent, type LivePaState } from './paEvents'
import { isSessionExpired } from './session'

export interface LivePa {
  state: LivePaState
  run: (scenario: ScenarioConfig) => Promise<LivePaState>
  reset: () => void
}

function transportError(err: unknown): string {
  if (err instanceof ApiError) return `Request failed (${err.status})`
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function useLivePa(csrfToken: string, onExpire: () => void): LivePa {
  const [state, setState] = useState<LivePaState>(initialPaState)
  const attemptsRef = useRef<AttemptMap>(new Map())

  const run = useCallback(
    async (scenario: ScenarioConfig): Promise<LivePaState> => {
      const attempt = nextAttempt(attemptsRef.current, scenario.id)
      let s = initialPaState
      setState(s)
      try {
        for await (const ev of streamPaSubmit(buildPaRequest(scenario, attempt), { csrfToken })) {
          s = reducePaEvent(s, ev)
          setState(s)
        }
        return s
      } catch (err) {
        if (isSessionExpired(err)) {
          onExpire()
          return s
        }
        const errored: LivePaState = { ...s, status: 'error', error: transportError(err) }
        setState(errored)
        return errored
      }
    },
    [csrfToken, onExpire],
  )

  const reset = useCallback(() => setState(initialPaState), [])

  return { state, run, reset }
}
