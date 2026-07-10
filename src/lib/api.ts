/**
 * Typed client for the backend API (06-api-contract.md).
 *
 * Auth is cookie-based: every request sends `credentials: "include"` and NO
 * Authorization header (the browser never holds the API secret). State-changing
 * POSTs additionally send the session CSRF token as `X-CSRF-Token` when the
 * caller supplies one.
 *
 * Streaming routes are POST `text/event-stream`, so we drive them with a
 * `fetch` body reader (sse.ts) rather than `EventSource`. Error semantics
 * mirror the contract: a non-200 *before* the stream throws `ApiError`; an
 * in-stream failure arrives as a terminal `error` EVENT (yielded, not thrown)
 * and the stream ends. Every stream ends after exactly one terminal
 * (`done`/`error`) event.
 */
import { readSseFrames } from './sse'
import type {
  AppealRequest,
  ResumeAppealRequest,
  InitialPaRequest,
  AppealEvent,
  ResumeEvent,
  PaSubmitEvent,
  AuditRecordsResponse,
  PendingReviewsResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
} from './wire'

/** Same-origin by default; overridable for split frontend/backend deploys. */
const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

export interface RequestOpts {
  /** Session CSRF token, sent as `X-CSRF-Token` on POST routes. */
  csrfToken?: string
  /** Abort signal so a caller can cancel a request or an open stream. */
  signal?: AbortSignal
}

/** Thrown when a request fails its HTTP status check before any stream body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** POST JSON with cookie auth + optional CSRF header. The returned `Response`
 * is read as JSON by unary callers and as an SSE body by the stream callers —
 * the request itself is identical either way. */
async function post(path: string, body: unknown, opts?: RequestOpts): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts?.csrfToken) headers['X-CSRF-Token'] = opts.csrfToken
  const response = await fetch(BASE_URL + path, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(body),
    signal: opts?.signal,
  })
  if (!response.ok) throw new ApiError(response.status, `POST ${path} failed: ${response.status}`)
  return response
}

async function getJson<T>(path: string, opts?: RequestOpts): Promise<T> {
  const response = await fetch(BASE_URL + path, {
    method: 'GET',
    credentials: 'include',
    signal: opts?.signal,
  })
  if (!response.ok) throw new ApiError(response.status, `GET ${path} failed: ${response.status}`)
  return (await response.json()) as T
}

/** Log in with demo credentials; the session arrives as an httpOnly cookie and
 * the CSRF token in the returned body (never persisted — held in memory only). */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  return (await (await post('/api/auth/login', body)).json()) as LoginResponse
}

/** Destroy the session (requires the CSRF token, like every authenticated write). */
export async function logout(opts?: RequestOpts): Promise<void> {
  await post('/api/auth/logout', {}, opts)
}

/** Resolve the current session's user, or throw `ApiError(401)` if none. */
export function me(opts?: RequestOpts): Promise<MeResponse> {
  return getJson<MeResponse>('/api/auth/me', opts)
}

async function* streamEvents<T>(response: Response): AsyncIterable<T> {
  // Frame `data` is compact JSON carrying the event's own `event` discriminant,
  // so parsing it is enough for callers to narrow the union.
  for await (const frame of readSseFrames(response)) {
    yield JSON.parse(frame.data) as T
  }
}

export async function* streamAppealGenerate(
  body: AppealRequest,
  opts?: RequestOpts,
): AsyncIterable<AppealEvent> {
  yield* streamEvents<AppealEvent>(await post('/api/appeal/generate', body, opts))
}

export async function* streamAppealResume(
  body: ResumeAppealRequest,
  opts?: RequestOpts,
): AsyncIterable<ResumeEvent> {
  yield* streamEvents<ResumeEvent>(await post('/api/appeal/resume', body, opts))
}

export async function* streamPaSubmit(
  body: InitialPaRequest,
  opts?: RequestOpts,
): AsyncIterable<PaSubmitEvent> {
  yield* streamEvents<PaSubmitEvent>(await post('/api/pa/submit', body, opts))
}

export function getAuditRecords(opts?: RequestOpts): Promise<AuditRecordsResponse> {
  return getJson<AuditRecordsResponse>('/api/audit/records', opts)
}

export function getPendingReviews(opts?: RequestOpts): Promise<PendingReviewsResponse> {
  return getJson<PendingReviewsResponse>('/api/reviews/pending', opts)
}
