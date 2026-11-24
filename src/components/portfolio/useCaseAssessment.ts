import { useEffect, useState } from 'react'
import { ApiError, getCaseAssessment } from '../../lib/api'
import type { CaseAssessment } from '../../lib/wire'
import type { Client } from '../../types'
import type { LiveShellSession } from '../live/SessionGate'

const BOUND_PEDIATRIC_CASE_ID: string | undefined = import.meta.env.VITE_PEDIATRIC_CASE_ID

export function resolveBackendCaseId(client: Client | null): string | undefined {
  if (!client) return undefined
  if (client.backendCaseId) return client.backendCaseId
  if (client.scenarioId === 'pediatric-esomeprazole' && BOUND_PEDIATRIC_CASE_ID) {
    return BOUND_PEDIATRIC_CASE_ID
  }
  return undefined
}

export function useCaseAssessment(
  client: Client | null,
  live?: LiveShellSession,
): { assessment: CaseAssessment | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{
    key: string
    assessment: CaseAssessment | null
    error: string | null
  }>({ key: '', assessment: null, error: null })

  const caseId = resolveBackendCaseId(client)
  const patientRef = client?.patientRef
  const key = live && patientRef && caseId ? `${patientRef}:${caseId}` : ''

  useEffect(() => {
    if (!key || !patientRef || !caseId) return
    const controller = new AbortController()
    getCaseAssessment(patientRef, caseId, { signal: controller.signal })
      .then(data => setState({ key, assessment: data, error: null }))
      .catch(err => {
        if (controller.signal.aborted) return
        if (err instanceof ApiError && err.status === 401) {
          live?.onExpire()
          return
        }
        const message = err instanceof Error ? err.message : 'Unable to load backend assessment'
        setState({ key, assessment: null, error: message })
      })
    return () => controller.abort()
  }, [key, patientRef, caseId, live])

  if (!key) return { assessment: null, loading: false, error: null }
  const settled = state.key === key
  return {
    assessment: settled ? state.assessment : null,
    loading: !settled,
    error: settled ? state.error : null,
  }
}
