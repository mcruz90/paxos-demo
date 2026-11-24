import { ApiError, type RequestOpts } from '../../lib/api'
import type { CaseAttachment, CaseRecord, DiscoveryItem, DiscoveryResults } from '../../lib/wire'
import { sliceByCodePoints } from './assessmentEvidence'

export interface InspectedDiscoverySpan {
  isMetadataOnly: boolean
  statusText: string
  before: string
  highlight: string
  after: string
  excerpt: string | null
  start: number | null
  end: number | null
  contentSha256: string
}

export interface DiscoveryState {
  revision: number | null
  results: DiscoveryResults | null
  attachments: CaseAttachment[]
  attachmentsError: string | null
  discoveryError: string | null
  actionError: string | null
  isSearching: boolean
  isLoadingAttachments: boolean
  busyActionKey: string | null
  inspectedItem: DiscoveryItem | null
  staleQuery: boolean
}

export interface DiscoveryApiDeps {
  getCaseRecord?: (patientRef: string, caseId: string, opts?: RequestOpts) => Promise<CaseRecord>
  searchCaseDiscovery: (
    patientRef: string,
    caseId: string,
    body: { expected_revision: number; query: string },
    opts?: RequestOpts,
  ) => Promise<DiscoveryResults>
  listCaseAttachments: (patientRef: string, caseId: string, opts?: RequestOpts) => Promise<CaseAttachment[]>
  attachDiscoveryResult: (
    patientRef: string,
    caseId: string,
    body: { expected_revision: number; request_id: string; result_id: string },
    opts?: RequestOpts,
  ) => Promise<CaseAttachment>
  removeCaseAttachment: (
    patientRef: string,
    caseId: string,
    attachmentId: string,
    body: { expected_revision: number; request_id: string },
    opts?: RequestOpts,
  ) => Promise<CaseAttachment>
}

interface ControllerRuntime {
  patientRef: string
  caseId: string
  api: DiscoveryApiDeps
  getOpts?: () => RequestOpts | undefined
  onAuthExpire?: () => void
  getState: () => DiscoveryState
  update: (patch: Partial<DiscoveryState>) => void
  getOrCreateRequestId: (key: string) => string
  clearRequestId: (key: string) => void
  inFlight: Map<string, Promise<void>>
}

export function mapDiscoveryError(err: unknown): string {
  const status = err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status
  if (status === 409) return 'the case changed: reload'
  if (status === 404) return 'not available'
  if (status === 503) return 'Discovery service temporarily unavailable — please try again.'
  return err instanceof Error && err.message ? err.message : 'Unable to complete discovery request'
}

function isAuthError(err: unknown): boolean {
  const status = err instanceof ApiError ? err.status : (err as { status?: number } | null)?.status
  return status === 401
}

export function inspectDiscoveryItem(
  item: DiscoveryItem,
  sourceBodies?: Record<string, string>,
): InspectedDiscoverySpan {
  if (item.availability === 'metadata_only') {
    return {
      isMetadataOnly: true, statusText: 'metadata only: not read',
      before: '', highlight: '', after: '', excerpt: null, start: null, end: null, contentSha256: item.content_sha256,
    }
  }
  const fullBody = sourceBodies?.[item.source_version_id]
  if (fullBody !== undefined) {
    const before = sliceByCodePoints(fullBody, 0, item.start)
    const highlight = sliceByCodePoints(fullBody, item.start, item.end)
    const after = sliceByCodePoints(fullBody, item.end, Array.from(fullBody).length)
    return {
      isMetadataOnly: false, statusText: 'full text', before, highlight, after,
      excerpt: highlight || item.excerpt, start: item.start, end: item.end, contentSha256: item.content_sha256,
    }
  }
  return {
    isMetadataOnly: false, statusText: 'full text', before: '', highlight: item.excerpt, after: '',
    excerpt: item.excerpt, start: item.start, end: item.end, contentSha256: item.content_sha256,
  }
}

export function formatAttachmentSpan(item: DiscoveryItem): string {
  return item.availability === 'metadata_only' ? 'metadata only: not read' : `${item.source_version_id} [${item.start}..${item.end})`
}

function defaultUuid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : '00000000-0000-4000-8000-000000000000'
}

async function resolveRevision(rt: ControllerRuntime): Promise<number | null> {
  const current = rt.getState().revision
  if (current !== null) return current
  if (!rt.api.getCaseRecord) return null
  const record = await rt.api.getCaseRecord(rt.patientRef, rt.caseId, rt.getOpts?.())
  rt.update({ revision: record.revision })
  return record.revision
}

async function executeSearch(rt: ControllerRuntime, query: string): Promise<void> {
  if (rt.getState().isSearching) return
  rt.update({ isSearching: true, discoveryError: null, actionError: null })
  try {
    const expectedRevision = await resolveRevision(rt)
    if (expectedRevision === null) { rt.update({ isSearching: false, discoveryError: 'not available' }); return }
    const res = await rt.api.searchCaseDiscovery(
      rt.patientRef, rt.caseId, { expected_revision: expectedRevision, query }, rt.getOpts?.(),
    )
    rt.update({ results: res, revision: res.revision, isSearching: false, staleQuery: false, inspectedItem: null })
  } catch (err) {
    if (isAuthError(err)) { rt.onAuthExpire?.(); return }
    rt.update({ isSearching: false, discoveryError: mapDiscoveryError(err) })
  }
}

function executeAttach(rt: ControllerRuntime, item: DiscoveryItem): Promise<void> {
  const actionKey = `attach:${item.result_id}`
  const existing = rt.inFlight.get(actionKey)
  if (existing) return existing
  const task = (async () => {
    rt.update({ busyActionKey: actionKey, actionError: null })
    try {
      const state = rt.getState()
      const expectedRevision = state.results?.revision ?? state.revision
      if (expectedRevision === null) { rt.update({ busyActionKey: null, actionError: 'run the search again' }); return }
      const created = await rt.api.attachDiscoveryResult(
        rt.patientRef, rt.caseId,
        { expected_revision: expectedRevision, request_id: rt.getOrCreateRequestId(actionKey), result_id: item.result_id },
        rt.getOpts?.(),
      )
      rt.clearRequestId(actionKey)
      const prev = rt.getState().attachments
      const next = prev.some(a => a.attachment_id === created.attachment_id) ? prev : [...prev, created]
      rt.update({ attachments: next, busyActionKey: null, attachmentsError: null })
    } catch (err) {
      if (isAuthError(err)) { rt.onAuthExpire?.(); return }
      rt.update({ busyActionKey: null, actionError: mapDiscoveryError(err) })
    } finally {
      rt.inFlight.delete(actionKey)
    }
  })()
  rt.inFlight.set(actionKey, task)
  return task
}

function executeRemove(rt: ControllerRuntime, attachment: CaseAttachment): Promise<void> {
  const actionKey = `remove:${attachment.attachment_id}`
  const existing = rt.inFlight.get(actionKey)
  if (existing) return existing
  const task = (async () => {
    rt.update({ busyActionKey: actionKey, actionError: null })
    try {
      const expectedRevision = await resolveRevision(rt)
      if (expectedRevision === null) { rt.update({ busyActionKey: null, actionError: 'not available' }); return }
      await rt.api.removeCaseAttachment(
        rt.patientRef, rt.caseId, attachment.attachment_id,
        { expected_revision: expectedRevision, request_id: rt.getOrCreateRequestId(actionKey) },
        rt.getOpts?.(),
      )
      rt.clearRequestId(actionKey)
      const cur = rt.getState()
      const next = cur.attachments.filter(a => a.attachment_id !== attachment.attachment_id)
      const nextInspected = cur.inspectedItem?.result_id === attachment.item.result_id ? null : cur.inspectedItem
      rt.update({ attachments: next, busyActionKey: null, inspectedItem: nextInspected })
    } catch (err) {
      if (isAuthError(err)) { rt.onAuthExpire?.(); return }
      rt.update({ busyActionKey: null, actionError: mapDiscoveryError(err) })
    } finally {
      rt.inFlight.delete(actionKey)
    }
  })()
  rt.inFlight.set(actionKey, task)
  return task
}

export function createDiscoveryController(deps: {
  patientRef: string
  caseId: string
  initialRevision: number | null
  api: DiscoveryApiDeps
  getOpts?: () => RequestOpts | undefined
  makeRequestId?: () => string
  onAuthExpire?: () => void
  onChange?: (state: DiscoveryState) => void
}) {
  const makeId = deps.makeRequestId ?? defaultUuid
  const requestIds = new Map<string, string>()
  let state: DiscoveryState = {
    revision: deps.initialRevision, results: null, attachments: [], attachmentsError: null,
    discoveryError: null, actionError: null, isSearching: false, isLoadingAttachments: false,
    busyActionKey: null, inspectedItem: null, staleQuery: false,
  }
  const rt: ControllerRuntime = {
    patientRef: deps.patientRef, caseId: deps.caseId, api: deps.api, getOpts: deps.getOpts,
    onAuthExpire: deps.onAuthExpire, inFlight: new Map<string, Promise<void>>(),
    getState: () => state,
    update: patch => { state = { ...state, ...patch }; deps.onChange?.(state) },
    getOrCreateRequestId: key => { const id = requestIds.get(key) ?? makeId(); requestIds.set(key, id); return id },
    clearRequestId: key => { requestIds.delete(key) },
  }
  const loadAttachments = async () => {
    rt.update({ isLoadingAttachments: true, attachmentsError: null })
    try {
      const list = await rt.api.listCaseAttachments(rt.patientRef, rt.caseId, rt.getOpts?.())
      rt.update({ attachments: list, isLoadingAttachments: false, attachmentsError: null })
    } catch (err) {
      if (isAuthError(err)) { rt.onAuthExpire?.(); return }
      rt.update({ isLoadingAttachments: false, attachmentsError: mapDiscoveryError(err) })
    }
  }
  return {
    getState: rt.getState,
    setRevision: (rev: number | null) => {
      rt.update({ revision: rev, staleQuery: !!(state.results && rev !== null && state.results.revision !== rev) })
    },
    inspect: (item: DiscoveryItem | null) => rt.update({ inspectedItem: item }),
    loadAttachments,
    search: (query: string) => executeSearch(rt, query),
    attach: (item: DiscoveryItem) => executeAttach(rt, item),
    remove: (attachment: CaseAttachment) => executeRemove(rt, attachment),
  }
}
