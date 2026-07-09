import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  ApiError,
  streamAppealGenerate,
  streamAppealResume,
  streamPaSubmit,
  getAuditRecords,
  getPendingReviews,
  login,
  logout,
  me,
} from './api'
import type { AppealRequest, InitialPaRequest, ResumeAppealRequest } from './wire'

const frame = (event: string, data: string) => `event: ${event}\ndata: ${data}\n\n`

function sseResponse(body: string, init?: ResponseInit): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })
  return new Response(stream, init)
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const appealBody = { scenario_id: 'x' } as unknown as AppealRequest
const resumeBody = { correlation_id: 'x:a1' } as unknown as ResumeAppealRequest
const paBody = { scenario_id: 'x' } as unknown as InitialPaRequest

afterEach(() => vi.unstubAllGlobals())

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const v of it) out.push(v)
  return out
}

describe('streamAppealGenerate', () => {
  it('yields the narrowed event union in arrival order', async () => {
    stubFetch(
      sseResponse(
        frame('step', '{"event":"step","step":"ingestion","label":"…"}') +
          frame('chunk', '{"event":"chunk","text":"Dear "}') +
          frame('done', '{"event":"done","ref":"abc","correlation_id":"x:a1"}'),
      ),
    )
    const events = await collect(streamAppealGenerate(appealBody))
    expect(events.map(e => e.event)).toEqual(['step', 'chunk', 'done'])
    const done = events[2]
    if (done.event === 'done') expect(done.ref).toBe('abc')
  })

  it('yields an in-stream error as a terminal event, not a throw', async () => {
    stubFetch(sseResponse(frame('error', '{"event":"error","message":"boom","correlation_id":"x:a1"}')))
    const events = await collect(streamAppealGenerate(appealBody))
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.event).toBe('error')
    if (ev.event === 'error') expect(ev.message).toBe('boom')
  })

  it('throws a typed ApiError carrying the status on a non-200 before the stream', async () => {
    stubFetch(sseResponse('{"detail":"Invalid API key"}', { status: 401 }))
    const err = await collect(streamAppealGenerate(appealBody)).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })

  it('POSTs with cookie credentials and no Authorization header', async () => {
    const fetchMock = stubFetch(sseResponse(frame('done', '{"event":"done","ref":"r","correlation_id":"c"}')))
    await collect(streamAppealGenerate(appealBody))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/appeal/generate')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['X-CSRF-Token']).toBeUndefined()
    expect(init?.body).toBe(JSON.stringify(appealBody))
  })

  it('sends the CSRF token as X-CSRF-Token when provided', async () => {
    const fetchMock = stubFetch(sseResponse(frame('done', '{"event":"done","ref":"r","correlation_id":"c"}')))
    await collect(streamAppealGenerate(appealBody, { csrfToken: 'tok123' }))
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['X-CSRF-Token']).toBe('tok123')
  })
})

describe('streamAppealResume', () => {
  it('yields the resume terminal event', async () => {
    const fetchMock = stubFetch(
      sseResponse(frame('done', '{"event":"done","ref":"r","tier":"exception","correlation_id":"x:a1"}')),
    )
    const events = await collect(streamAppealResume(resumeBody))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/appeal/resume')
    expect(events[0].event).toBe('done')
  })
})

describe('streamPaSubmit', () => {
  it('yields step then the InitialPaDone terminal', async () => {
    const fetchMock = stubFetch(
      sseResponse(
        frame('step', '{"event":"step","step":"crd_check","label":"…"}') +
          frame('done', '{"event":"done","submission_ref":"PAS-1","correlation_id":"c:a1"}'),
      ),
    )
    const events = await collect(streamPaSubmit(paBody))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pa/submit')
    expect(events.map(e => e.event)).toEqual(['step', 'done'])
    const done = events[1]
    if (done.event === 'done') expect(done.submission_ref).toBe('PAS-1')
  })
})

describe('getAuditRecords', () => {
  it('GETs with credentials and returns the parsed body', async () => {
    const fetchMock = stubFetch(
      new Response('{"records":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const body = await getAuditRecords()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/audit/records')
    expect(init?.method).toBe('GET')
    expect(init?.credentials).toBe('include')
    expect(body.records).toEqual([])
  })

  it('throws ApiError on a non-200', async () => {
    stubFetch(new Response('{"detail":"Invalid API key"}', { status: 401 }))
    await expect(getAuditRecords()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('getPendingReviews', () => {
  it('GETs the pending-reviews endpoint', async () => {
    const fetchMock = stubFetch(
      new Response('{"reviews":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const body = await getPendingReviews()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/reviews/pending')
    expect(body.reviews).toEqual([])
  })
})

describe('login', () => {
  it('POSTs credentials with cookie credentials and returns the csrf token', async () => {
    const fetchMock = stubFetch(
      new Response('{"user_id":"demo","csrf_token":"tok"}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const resp = await login({ username: 'demo', password: 'pw' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/login')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBe('include')
    expect(resp.csrf_token).toBe('tok')
  })

  it('throws ApiError(401) on bad credentials', async () => {
    stubFetch(new Response('{"detail":"Invalid credentials"}', { status: 401 }))
    const err = await login({ username: 'x', password: 'y' }).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(401)
  })
})

describe('logout', () => {
  it('POSTs with the CSRF token', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))
    await logout({ csrfToken: 'tok' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/auth/logout')
    const headers = init?.headers as Record<string, string>
    expect(headers['X-CSRF-Token']).toBe('tok')
  })
})

describe('me', () => {
  it('GETs the current session user', async () => {
    const fetchMock = stubFetch(
      new Response('{"user_id":"demo"}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const body = await me()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me')
    expect(body.user_id).toBe('demo')
  })

  it('throws ApiError(401) when there is no session', async () => {
    stubFetch(new Response('{"detail":"Session required"}', { status: 401 }))
    await expect(me()).rejects.toBeInstanceOf(ApiError)
  })
})
