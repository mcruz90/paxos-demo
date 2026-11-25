import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'

const PATIENT_REF = 'PT-4201'
const CASE_ID = '11111111-2222-4333-8444-555555555555'
const QUERY_ID = '22222222-3333-4444-8555-666666666666'
const RESULT_ID = '33333333-4444-4555-8666-777777777777'
const ATTACHMENT_ID = '44444444-5555-4666-8777-888888888888'
const SHA = 'a'.repeat(64)

type DiscoveryApiSurface = {
  getCaseRecord: (patientRef: string, caseId: string, opts?: api.RequestOpts) => Promise<unknown>
  searchCaseDiscovery: (
    patientRef: string,
    caseId: string,
    body: { expected_revision: number; query: string; request_id?: string | null },
    opts?: api.RequestOpts,
  ) => Promise<unknown>
  getDiscoveryResults: (patientRef: string, caseId: string, queryId: string, opts?: api.RequestOpts) => Promise<unknown>
  listCaseAttachments: (patientRef: string, caseId: string, opts?: api.RequestOpts) => Promise<unknown>
  attachDiscoveryResult: (
    patientRef: string,
    caseId: string,
    body: { expected_revision: number; request_id: string; result_id: string },
    opts?: api.RequestOpts,
  ) => Promise<unknown>
  removeCaseAttachment: (
    patientRef: string,
    caseId: string,
    attachmentId: string,
    body: { expected_revision: number; request_id: string },
    opts?: api.RequestOpts,
  ) => Promise<unknown>
}

const discoveryApi = api as unknown as Partial<DiscoveryApiSurface>

afterEach(() => vi.unstubAllGlobals())

describe('G-07 discovery & attachment API routes', () => {
  it('GETs CaseRecord for expected_revision', async () => {
    expect(typeof discoveryApi.getCaseRecord).toBe('function')
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ case_id: CASE_ID, tenant_id: 'tenant_demo', patient_ref: PATIENT_REF, revision: 3 }), {
          status: 200,
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const record = await discoveryApi.getCaseRecord!(PATIENT_REF, CASE_ID)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}`)
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include')
    expect((record as { revision: number }).revision).toBe(3)
  })

  it('POSTs DiscoverySearch with request_id and GETs results by query_id', async () => {
    expect(typeof discoveryApi.searchCaseDiscovery).toBe('function')
    expect(typeof discoveryApi.getDiscoveryResults).toBe('function')
    const payload = { query_id: QUERY_ID, query: 'esomeprazole', revision: 2, items: [] }
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    await discoveryApi.searchCaseDiscovery!(
      PATIENT_REF,
      CASE_ID,
      { expected_revision: 2, query: 'esomeprazole', request_id: 'req-search-1' },
      { csrfToken: 'csrf-1' },
    )
    const [postUrl, postInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(postUrl).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}/discovery`)
    expect(postInit.method).toBe('POST')
    expect(postInit.credentials).toBe('include')
    expect((postInit.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect((postInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1')
    const sentBody = JSON.parse(postInit.body as string) as { expected_revision: number; query: string; request_id: string }
    expect(sentBody).toEqual({ expected_revision: 2, query: 'esomeprazole', request_id: 'req-search-1' })
    expect(sentBody.request_id).toMatch(/^[A-Za-z0-9._:-]{1,128}$/)

    await discoveryApi.getDiscoveryResults!(PATIENT_REF, CASE_ID, QUERY_ID)
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}/discovery/${QUERY_ID}`)
  })

  it('lists attachments, attaches a result, and DELETEs an attachment with JSON body and Content-Type header', async () => {
    expect(typeof discoveryApi.listCaseAttachments).toBe('function')
    expect(typeof discoveryApi.attachDiscoveryResult).toBe('function')
    expect(typeof discoveryApi.removeCaseAttachment).toBe('function')
    const attachment = {
      attachment_id: ATTACHMENT_ID,
      actor_id: 'clinician-1',
      attached_at: '2026-11-22T15:00:00Z',
      item: {
        availability: 'full_text',
        category: 'clinical_note',
        content_sha256: SHA,
        start: 0,
        end: 10,
        excerpt: 'Note text.',
        result_id: RESULT_ID,
        source_id: 'epic-notes',
        source_version_id: 'gi-v1',
        title: 'GI Note',
      },
    }
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'GET' || !init?.method) {
        return Promise.resolve(new Response(JSON.stringify([attachment]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify(attachment), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const listed = await discoveryApi.listCaseAttachments!(PATIENT_REF, CASE_ID)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}/attachments`)
    expect(Array.isArray(listed)).toBe(true)

    await discoveryApi.attachDiscoveryResult!(
      PATIENT_REF,
      CASE_ID,
      { expected_revision: 2, request_id: 'req-attach-1', result_id: RESULT_ID },
      { csrfToken: 'csrf-2' },
    )
    const [attachUrl, attachInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(attachUrl).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}/attachments`)
    expect(attachInit.method).toBe('POST')
    expect((attachInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-2')
    expect(JSON.parse(attachInit.body as string)).toEqual({
      expected_revision: 2,
      request_id: 'req-attach-1',
      result_id: RESULT_ID,
    })

    await discoveryApi.removeCaseAttachment!(
      PATIENT_REF,
      CASE_ID,
      ATTACHMENT_ID,
      { expected_revision: 2, request_id: 'req-del-1' },
      { csrfToken: 'csrf-3' },
    )
    const [delUrl, delInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(delUrl).toBe(`/api/patients/${PATIENT_REF}/cases/${CASE_ID}/attachments/${ATTACHMENT_ID}`)
    expect(delInit.method).toBe('DELETE')
    expect(delInit.credentials).toBe('include')
    expect((delInit.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect((delInit.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-3')
    expect(JSON.parse(delInit.body as string)).toEqual({
      expected_revision: 2,
      request_id: 'req-del-1',
    })
  })

  it('throws ApiError with exact status for 404, 409, and 503', async () => {
    expect(typeof discoveryApi.listCaseAttachments).toBe('function')
    expect(typeof discoveryApi.attachDiscoveryResult).toBe('function')
    expect(typeof discoveryApi.searchCaseDiscovery).toBe('function')

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"detail":"case_not_found"}', { status: 404 }))))
    const err404 = await discoveryApi.listCaseAttachments!(PATIENT_REF, CASE_ID).catch(e => e)
    expect(err404).toBeInstanceOf(api.ApiError)
    expect((err404 as api.ApiError).status).toBe(404)

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"detail":"case_conflict"}', { status: 409 }))))
    const err409 = await discoveryApi
      .attachDiscoveryResult!(PATIENT_REF, CASE_ID, { expected_revision: 1, request_id: 'r1', result_id: RESULT_ID })
      .catch(e => e)
    expect(err409).toBeInstanceOf(api.ApiError)
    expect((err409 as api.ApiError).status).toBe(409)

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"detail":"case_service_unavailable"}', { status: 503 }))))
    const err503 = await discoveryApi
      .searchCaseDiscovery!(PATIENT_REF, CASE_ID, { expected_revision: 1, query: 'q' })
      .catch(e => e)
    expect(err503).toBeInstanceOf(api.ApiError)
    expect((err503 as api.ApiError).status).toBe(503)
  })

  it('parses optional error code from JSON error bodies and ignores non-JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('{"detail":"case_conflict","code":"stale_case_revision"}', { status: 409 })),
      ),
    )
    const staleErr = await discoveryApi
      .attachDiscoveryResult!(PATIENT_REF, CASE_ID, { expected_revision: 1, request_id: 'r1', result_id: RESULT_ID })
      .catch(e => e)
    expect(staleErr).toBeInstanceOf(api.ApiError)
    expect((staleErr as api.ApiError).status).toBe(409)
    expect((staleErr as api.ApiError).code).toBe('stale_case_revision')

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('{"detail":"case_conflict","code":"idempotency_conflict"}', { status: 409 })),
      ),
    )
    const idemErr = await discoveryApi
      .listCaseAttachments!(PATIENT_REF, CASE_ID)
      .catch(e => e)
    expect(idemErr).toBeInstanceOf(api.ApiError)
    expect((idemErr as api.ApiError).status).toBe(409)
    expect((idemErr as api.ApiError).code).toBe('idempotency_conflict')

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{"detail":"case_conflict"}', { status: 409 }))))
    const noCodeErr = await discoveryApi
      .searchCaseDiscovery!(PATIENT_REF, CASE_ID, { expected_revision: 1, query: 'q', request_id: 'req-1' })
      .catch(e => e)
    expect(noCodeErr).toBeInstanceOf(api.ApiError)
    expect((noCodeErr as api.ApiError).status).toBe(409)
    expect((noCodeErr as api.ApiError).code).toBeUndefined()

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('Bad Gateway', { status: 503 }))))
    const htmlErr = await discoveryApi
      .searchCaseDiscovery!(PATIENT_REF, CASE_ID, { expected_revision: 1, query: 'q', request_id: 'req-1' })
      .catch(e => e)
    expect(htmlErr).toBeInstanceOf(api.ApiError)
    expect((htmlErr as api.ApiError).status).toBe(503)
    expect((htmlErr as api.ApiError).code).toBeUndefined()
  })
})
