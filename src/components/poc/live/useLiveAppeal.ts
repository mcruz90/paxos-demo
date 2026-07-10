/**
 * Drives the live appeal-generate + resume SSE streams into `LiveGenState`.
 *
 * The async iteration lives here; the fold is the pure `reduceAppealEvent`.
 * A 401 mid-stream calls `onExpire` (session expiry surfaces, not a crash);
 * any other thrown error (network drop, non-200 ApiError, parse failure)
 * lands as an `error` terminal so the UI leaves the spinner and can retry.
 * `drive` returns the final state so a caller (resume) can branch on the
 * terminal instead of assuming success. The parked draft letter is retained
 * so the resume editor can prefill it.
 */
import { useCallback, useRef, useState } from 'react'
import { ApiError, streamAppealGenerate, streamAppealResume } from '../../../lib/api'
import type { ScenarioConfig } from '../../../types'
import { buildAppealRequest } from './appealRequest'
import { nextAttempt, type AttemptMap } from './attempts'
import { initialGenState, reduceAppealEvent, type LiveGenState } from './appealEvents'
import { isSessionExpired } from './session'

export interface LiveAppeal {
  state: LiveGenState
  run: (scenario: ScenarioConfig) => Promise<LiveGenState>
  resume: (correlationId: string, editedText: string | null, csrfToken: string) => Promise<LiveGenState>
  reset: () => void
}

/** Client-facing message for a transport-level failure (in-stream errors carry
 * their own message via the `error` EVENT and never reach here). */
function transportError(err: unknown): string {
  if (err instanceof ApiError) return `Request failed (${err.status})`
  if (err instanceof Error) return err.message
  return 'Request failed'
}

export function useLiveAppeal(csrfToken: string, onExpire: () => void): LiveAppeal {
  const [state, setState] = useState<LiveGenState>(initialGenState)
  // Attempt counters persist across renders without re-rendering (ADR-0009).
  const attemptsRef = useRef<AttemptMap>(new Map())

  const drive = useCallback(
    async (events: AsyncIterable<Parameters<typeof reduceAppealEvent>[1]>): Promise<LiveGenState> => {
      let s = initialGenState
      setState(s)
      try {
        for await (const ev of events) {
          s = reduceAppealEvent(s, ev)
          setState(s)
        }
        return s
      } catch (err) {
        if (isSessionExpired(err)) {
          onExpire()
          return s
        }
        // Transport/parse failure: no terminal event arrived — synthesize one so
        // the stream doesn't hang in 'streaming' forever.
        const errored: LiveGenState = { ...s, status: 'error', error: transportError(err) }
        setState(errored)
        return errored
      }
    },
    [onExpire],
  )

  const run = useCallback(
    (scenario: ScenarioConfig) => {
      const attempt = nextAttempt(attemptsRef.current, scenario.id)
      return drive(streamAppealGenerate(buildAppealRequest(scenario, attempt), { csrfToken }))
    },
    [drive, csrfToken],
  )

  const resume = useCallback(
    (correlationId: string, editedText: string | null, token: string) =>
      drive(streamAppealResume({ correlation_id: correlationId, edited_text: editedText }, { csrfToken: token })),
    [drive],
  )

  const reset = useCallback(() => setState(initialGenState), [])

  return { state, run, resume, reset }
}
