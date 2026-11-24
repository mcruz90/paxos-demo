import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api'
import type { CaseAttachment, DiscoveryResults, FullTextResult } from '../../lib/wire'
import { createDiscoveryController } from './caseDiscovery'

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

describe('G-07 discovery controller idempotency, attach/remove, and error mapping', () => {
  it('attaches and removes one item at a time with expected_revision and request_id', async () => {
    const attachMock = vi.fn(async () => ATTACHED_FULL)
    const removeMock = vi.fn(async () => ATTACHED_FULL)
    const ctrl = createDiscoveryController({
      patientRef: 'PT-4201',
      caseId: CASE_ID,
      initialRevision: 2,
      makeRequestId: () => 'req-1',
      api: {
        searchCaseDiscovery: vi.fn(async () => DISCOVERY_RESULTS),
        listCaseAttachments: vi.fn(async () => []),
        attachDiscoveryResult: attachMock,
        removeCaseAttachment: removeMock,
      },
    })

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

    const ctrl = createDiscoveryController({
      patientRef: 'PT-4201',
      caseId: CASE_ID,
      initialRevision: 2,
      makeRequestId: makeId,
      api: {
        searchCaseDiscovery: vi.fn(async () => DISCOVERY_RESULTS),
        listCaseAttachments: vi.fn(async () => []),
        attachDiscoveryResult: attachMock,
        removeCaseAttachment: vi.fn(async () => ATTACHED_FULL),
      },
    })

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().actionError).toContain('unavailable')

    await Promise.all([ctrl.attach(FULL_TEXT_ITEM), ctrl.attach(FULL_TEXT_ITEM)])
    expect(makeId).toHaveBeenCalledTimes(1)
    expect(attachMock).toHaveBeenCalledTimes(2)
    expect(attachMock.mock.calls[0][2].request_id).toBe('req-1')
    expect(attachMock.mock.calls[1][2].request_id).toBe('req-1')
    expect(ctrl.getState().attachments).toHaveLength(1)
  })

  it('maps 409 to "the case changed: reload", 404 to "not available", and marks stale queries on revision change', async () => {
    const ctrl = createDiscoveryController({
      patientRef: 'PT-4201',
      caseId: CASE_ID,
      initialRevision: 2,
      makeRequestId: () => 'req-409',
      api: {
        searchCaseDiscovery: vi.fn(async () => DISCOVERY_RESULTS),
        listCaseAttachments: vi.fn(async () => { throw new ApiError(404, 'case_not_found') }),
        attachDiscoveryResult: vi.fn(async () => { throw new ApiError(409, 'case_conflict') }),
        removeCaseAttachment: vi.fn(async () => ATTACHED_FULL),
      },
    })

    await ctrl.loadAttachments()
    expect(ctrl.getState().attachmentsError).toBe('not available')

    await ctrl.search('esomeprazole')
    await ctrl.attach(FULL_TEXT_ITEM)
    expect(ctrl.getState().actionError).toBe('the case changed: reload')

    ctrl.setRevision(3)
    expect(ctrl.getState().staleQuery).toBe(true)
  })
})
