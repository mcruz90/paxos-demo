import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api'
import type { CaseAttachment, DiscoveryResults, FullTextResult } from '../../lib/wire'
import { createDiscoveryController, mapDiscoveryError, type DiscoveryApiDeps } from './caseDiscovery'

const SHA_1 = 'a'.repeat(64)
const CASE_ID = '11111111-2222-4333-8444-555555555555'
const QUERY_ID = '22222222-3333-4444-8555-666666666666'
const RESULT_FULL = '33333333-4444-4555-8666-777777777777'
const ATTACH_ID = '55555555-6666-4777-8888-999999999999'

const FULL_TEXT_ITEM: FullTextResult = {
  availability: 'full_text',
  category: 'clinical_note',
  content_sha256: SHA_1,
  start: 12,
  end: 30,
  excerpt: 'Esomeprazole 20 mg',
  result_id: RESULT_FULL,
  source_id: 'epic-gi-consult',
  source_version_id: 'gi-note-v3',
  title: 'Pediatric GI Consult Note',
}

const DISCOVERY_RESULTS: DiscoveryResults = {
  query_id: QUERY_ID,
  query: 'esomeprazole',
  revision: 2,
  items: [FULL_TEXT_ITEM],
}

const ATTACHED_FULL: CaseAttachment = {
  attachment_id: ATTACH_ID,
  actor_id: 'dr.patel',
  attached_at: '2026-11-22T15:10:00Z',
  item: FULL_TEXT_ITEM,
}

afterEach(() => vi.restoreAllMocks())

function makeController(
  apiOverrides: Partial<DiscoveryApiDeps> = {},
  opts: { makeRequestId?: () => string; onAuthExpire?: () => void } = {},
) {
  return createDiscoveryController({
    patientRef: 'PT-4201',
    caseId: CASE_ID,
    initialRevision: 2,
    makeRequestId: opts.makeRequestId,
    onAuthExpire: opts.onAuthExpire,
    api: {
      searchCaseDiscovery: vi.fn(async () => DISCOVERY_RESULTS),
      listCaseAttachments: vi.fn(async () => []),
      attachDiscoveryResult: vi.fn(async () => ATTACHED_FULL),
      removeCaseAttachment: vi.fn(async () => ATTACHED_FULL),
      ...apiOverrides,
    },
  })
}

describe('G-07 discovery controller idempotency, attach/remove, and error mapping', () => {
  it('attaches and removes one item at a time with expected_revision and request_id', async () => {
    const attachMock = vi.fn(async () => ATTACHED_FULL)
    const removeMock = vi.fn(async () => ATTACHED_FULL)
    const ctrl = makeController({ attachDiscoveryResult: attachMock, removeCaseAttachment: removeMock }, { makeRequestId: () => 'req-1' })

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().attachments).toHaveLength(1)

    await ctrl.remove(ATTACHED_FULL)
    expect(removeMock).toHaveBeenCalledWith('PT-4201', CASE_ID, ATTACH_ID, { expected_revision: 2, request_id: 'req-1' }, undefined)
    expect(ctrl.getState().attachments).toHaveLength(0)
  })

  it('reuses the same request_id on retry and deduplicates concurrent double-click', async () => {
    let idSeq = 0
    const makeId = vi.fn(() => `req-${++idSeq}`)
    const attachMock = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce(ATTACHED_FULL)

    const ctrl = makeController({ attachDiscoveryResult: attachMock }, { makeRequestId: makeId })

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().actionError).toContain('unavailable')

    await Promise.all([ctrl.attach(FULL_TEXT_ITEM), ctrl.attach(FULL_TEXT_ITEM)])
    expect(makeId).toHaveBeenCalledTimes(2)
    expect(attachMock).toHaveBeenCalledTimes(2)
    expect(attachMock.mock.calls[0][2].request_id).toBe('req-2')
    expect(attachMock.mock.calls[1][2].request_id).toBe('req-2')
    expect(ctrl.getState().attachments).toHaveLength(1)
  })

  it('maps 409 to "the case changed: reload", 404 to "not available", and marks stale queries on revision change', async () => {
    const ctrl = makeController(
      {
        listCaseAttachments: vi.fn(async () => { throw new ApiError(404, 'case_not_found') }),
        attachDiscoveryResult: vi.fn(async () => { throw new ApiError(409, 'case_conflict') }),
      },
      { makeRequestId: () => 'req-409' },
    )

    await ctrl.loadAttachments()
    expect(ctrl.getState().attachmentsError).toBe('not available')

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().actionError).toBe('the case changed: reload')

    ctrl.setRevision(3)
    expect(ctrl.getState().staleQuery).toBe(true)
  })
})

describe('G-08 L1 discovery search request_id and in-flight guard', () => {
  it('sends a valid request_id, reuses it on retry after error, and rotates it after success', async () => {
    let idSeq = 0
    const makeId = vi.fn(() => `search-req-${++idSeq}`)
    const searchMock = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce(DISCOVERY_RESULTS)
      .mockResolvedValueOnce({ ...DISCOVERY_RESULTS, query: 'pantoprazole' })

    const ctrl = makeController({ searchCaseDiscovery: searchMock }, { makeRequestId: makeId })

    await ctrl.search('esomeprazole')
    expect(ctrl.getState().discoveryError).toContain('unavailable')
    expect(ctrl.getState().isSearching).toBe(false)

    await ctrl.search('esomeprazole')
    expect(ctrl.getState().discoveryError).toBeNull()
    expect(ctrl.getState().results).toEqual(DISCOVERY_RESULTS)

    await ctrl.search('pantoprazole')

    expect(searchMock).toHaveBeenCalledTimes(3)
    const firstId = searchMock.mock.calls[0][2].request_id
    const retryId = searchMock.mock.calls[1][2].request_id
    const nextId = searchMock.mock.calls[2][2].request_id
    expect(typeof firstId).toBe('string')
    expect(firstId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)
    expect(retryId).toBe(firstId)
    expect(nextId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)
    expect(nextId).not.toBe(firstId)
  })

  it('keeps isSearching true while search is in flight and blocks duplicate search calls', async () => {
    let resolveSearch!: (v: DiscoveryResults) => void
    const searchMock = vi.fn<DiscoveryApiDeps['searchCaseDiscovery']>(
      () => new Promise<DiscoveryResults>(resolve => { resolveSearch = resolve }),
    )

    const ctrl = makeController({ searchCaseDiscovery: searchMock })

    const p1 = ctrl.search('esomeprazole')
    expect(ctrl.getState().isSearching).toBe(true)
    const p2 = ctrl.search('esomeprazole')
    await Promise.resolve()
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(searchMock.mock.calls[0]?.[2].request_id).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)

    resolveSearch(DISCOVERY_RESULTS)
    await Promise.all([p1, p2])
    expect(ctrl.getState().isSearching).toBe(false)
  })

  it('reuses request_id only on true retry (same query & revision) after network/5xx error and clears on new query or setRevision', async () => {
    let idSeq = 0
    const makeId = vi.fn(() => `m1-req-${++idSeq}`)
    const searchMock = vi
      .fn<DiscoveryApiDeps['searchCaseDiscovery']>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new ApiError(500, 'internal_error'))
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({ ...DISCOVERY_RESULTS, query: 'pantoprazole' })
      .mockRejectedValueOnce(new ApiError(503, 'unavailable'))
      .mockResolvedValueOnce({ ...DISCOVERY_RESULTS, revision: 3 })

    const ctrl = makeController({ searchCaseDiscovery: searchMock }, { makeRequestId: makeId })

    await ctrl.search('esomeprazole')
    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[1][2].request_id).toBe(searchMock.mock.calls[0][2].request_id)

    await ctrl.search('pantoprazole')
    expect(searchMock.mock.calls[2][2].request_id).not.toBe(searchMock.mock.calls[1][2].request_id)

    await ctrl.search('pantoprazole')
    expect(searchMock.mock.calls[3][2].request_id).toBe(searchMock.mock.calls[2][2].request_id)

    await ctrl.search('esomeprazole')
    ctrl.setRevision(3)
    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[5][2].expected_revision).toBe(3)
    expect(searchMock.mock.calls[5][2].request_id).not.toBe(searchMock.mock.calls[4][2].request_id)
  })

  it('clears pending search request_id after final 4xx responses (409 stale_case_revision, 409 idempotency_conflict, 404, 400, 401)', async () => {
    let idSeq = 0
    const makeId = vi.fn(() => `m1-4xx-${++idSeq}`)
    const onAuthExpire = vi.fn()
    const searchMock = vi
      .fn<DiscoveryApiDeps['searchCaseDiscovery']>()
      .mockRejectedValueOnce(new ApiError(409, 'case_conflict', 'stale_case_revision'))
      .mockRejectedValueOnce(new ApiError(409, 'case_conflict', 'stale_case_revision'))
      .mockRejectedValueOnce(new ApiError(409, 'case_conflict', 'idempotency_conflict'))
      .mockRejectedValueOnce(new ApiError(404, 'case_not_found'))
      .mockRejectedValueOnce(new ApiError(400, 'invalid_query'))
      .mockRejectedValueOnce(new ApiError(401, 'unauthorized'))
      .mockResolvedValueOnce(DISCOVERY_RESULTS)

    const ctrl = makeController({ searchCaseDiscovery: searchMock }, { makeRequestId: makeId, onAuthExpire })

    await ctrl.search('esomeprazole')
    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[1][2].request_id).not.toBe(searchMock.mock.calls[0][2].request_id)

    ctrl.setRevision(3)
    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[2][2].request_id).not.toBe(searchMock.mock.calls[1][2].request_id)

    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[3][2].request_id).not.toBe(searchMock.mock.calls[2][2].request_id)

    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[4][2].request_id).not.toBe(searchMock.mock.calls[3][2].request_id)

    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[5][2].request_id).not.toBe(searchMock.mock.calls[4][2].request_id)
    expect(onAuthExpire).toHaveBeenCalledTimes(1)

    await ctrl.search('esomeprazole')
    expect(searchMock.mock.calls[6][2].request_id).not.toBe(searchMock.mock.calls[5][2].request_id)
  })
})

describe('G-08 L2 409 conflict code error mapping', () => {
  it('maps 409 by code (stale_case_revision, idempotency_conflict, missing) and preserves 404/503', async () => {
    expect(mapDiscoveryError(new ApiError(409, 'case_conflict', 'stale_case_revision'))).toBe(
      'the case changed: reload',
    )

    const idemMsg = mapDiscoveryError(new ApiError(409, 'case_conflict', 'idempotency_conflict'))
    expect(idemMsg).not.toBe('the case changed: reload')
    expect(idemMsg.toLowerCase()).toContain('same request')
    expect(idemMsg.toLowerCase()).toContain('different')
    expect(idemMsg.toLowerCase()).toContain('not applied')
    expect(idemMsg).not.toMatch(/idempotency_conflict|case_conflict|409/)

    expect(mapDiscoveryError(new ApiError(409, 'case_conflict'))).toBe('the case changed: reload')
    expect(mapDiscoveryError({ status: 409 })).toBe('the case changed: reload')
    expect(mapDiscoveryError(new ApiError(404, 'case_not_found'))).toBe('not available')
    expect(mapDiscoveryError(new ApiError(503, 'case_service_unavailable'))).toBe(
      'Discovery service temporarily unavailable — please try again.',
    )

    const ctrl = makeController(
      { attachDiscoveryResult: vi.fn(async () => { throw new ApiError(409, 'case_conflict', 'idempotency_conflict') }) },
      { makeRequestId: () => 'req-idem' },
    )

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().actionError).toBe(idemMsg)
  })
})
