import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../../lib/api'
import type { Client } from '../../types'
import type { LiveShellSession } from '../live/SessionGate'
import { createDiscoveryController, type DiscoveryState } from './caseDiscovery'
import type { CaseDiscoveryRailProps } from './DiscoveryEvidencePanel'
import { resolveBackendCaseId } from './useCaseAssessment'

const INITIAL_STATE: DiscoveryState = {
  revision: null,
  results: null,
  attachments: [],
  attachmentsError: null,
  discoveryError: null,
  actionError: null,
  isSearching: false,
  isLoadingAttachments: false,
  busyActionKey: null,
  inspectedItem: null,
  staleQuery: false,
}

export function useCaseDiscovery(
  client: Client | null,
  live?: LiveShellSession,
  assessmentRevision?: number | null,
): CaseDiscoveryRailProps | undefined {
  const caseId = resolveBackendCaseId(client)
  const patientRef = client?.patientRef
  const enabled = !!(live && patientRef && caseId)

  const [queryInput, setQueryInput] = useState('')
  const [state, setState] = useState<DiscoveryState>(INITIAL_STATE)
  const csrfRef = useRef(live?.csrfToken)
  csrfRef.current = live?.csrfToken
  const onExpireRef = useRef(live?.onExpire)
  onExpireRef.current = live?.onExpire

  const controller = useMemo(() => {
    if (!enabled || !patientRef || !caseId) return null
    return createDiscoveryController({
      patientRef,
      caseId,
      initialRevision: assessmentRevision ?? null,
      api,
      getOpts: () => (csrfRef.current ? { csrfToken: csrfRef.current } : undefined),
      onAuthExpire: () => onExpireRef.current?.(),
      onChange: setState,
    })
    // Re-create controller only when switching patient/case identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patientRef, caseId])

  useEffect(() => {
    if (!controller) {
      setState(INITIAL_STATE)
      return
    }
    setQueryInput('')
    setState(controller.getState())
    void controller.loadAttachments()
  }, [controller])

  useEffect(() => {
    if (controller && assessmentRevision !== undefined && assessmentRevision !== null) {
      controller.setRevision(assessmentRevision)
    }
  }, [controller, assessmentRevision])

  if (!controller) return undefined

  return {
    queryInput,
    setQueryInput,
    results: state.results,
    attachments: state.attachments,
    attachmentsError: state.attachmentsError,
    discoveryError: state.discoveryError,
    actionError: state.actionError,
    isSearching: state.isSearching,
    isLoadingAttachments: state.isLoadingAttachments,
    busyActionKey: state.busyActionKey,
    inspectedItem: state.inspectedItem,
    staleQuery: state.staleQuery,
    onInspectItem: item => controller.inspect(item),
    onSearch: q => controller.search(q ?? queryInput),
    onAttach: item => controller.attach(item),
    onRemove: att => controller.remove(att),
  }
}
