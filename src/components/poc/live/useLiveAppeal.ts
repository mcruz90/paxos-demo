/**
 * Drives the live appeal-generate + resume SSE streams into `LiveGenState`.
 *
 * The async iteration lives here; the fold is the pure `reduceAppealEvent`.
 * A 401 mid-stream calls `onExpire` (session expiry surfaces, not a crash).
 * The parked draft letter is retained so the resume editor can prefill it.
 */
import { useCallback, useState } from 'react'
import { streamAppealGenerate, streamAppealResume } from '../../../lib/api'
import type { ScenarioConfig } from '../../../types'
import { buildAppealRequest } from './appealRequest'
import { initialGenState, reduceAppealEvent, type LiveGenState } from './appealEvents'
import { isSessionExpired } from './session'

export interface LiveAppeal {
  state: LiveGenState
  run: (scenario: ScenarioConfig) => Promise<void>
  resume: (correlationId: string, editedText: string | null, csrfToken: string) => Promise<void>
  reset: () => void
}

export function useLiveAppeal(csrfToken: string, onExpire: () => void): LiveAppeal {
  const [state, setState] = useState<LiveGenState>(initialGenState)

  const drive = useCallback(
    async (events: AsyncIterable<Parameters<typeof reduceAppealEvent>[1]>) => {
      let s = initialGenState
      setState(s)
      try {
        for await (const ev of events) {
          s = reduceAppealEvent(s, ev)
          setState(s)
        }
      } catch (err) {
        if (isSessionExpired(err)) onExpire()
      }
    },
    [onExpire],
  )

  const run = useCallback(
    (scenario: ScenarioConfig) => drive(streamAppealGenerate(buildAppealRequest(scenario), { csrfToken })),
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
