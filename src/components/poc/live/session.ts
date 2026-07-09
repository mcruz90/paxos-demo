/**
 * Pure live-session state + transitions (auth held in memory only).
 *
 * The httpOnly session cookie is set by the backend and never readable here;
 * we hold only `{ userId, csrfToken }` — the CSRF token echoed on writes — in
 * React state, NEVER localStorage/sessionStorage (PHI app, per the slice spec).
 * These transitions are pure so the login/expiry state machine is unit-tested;
 * useLiveSession only wires them to the api.ts calls.
 */
import { ApiError } from '../../../lib/api'
import type { LoginResponse } from '../../../lib/wire'

export interface Session {
  userId: string
  csrfToken: string
}

export interface AuthState {
  session: Session | null
  /** A 401 mid-flow surfaces "session expired, log in again" (not a crash). */
  expired: boolean
  /** Failed-login message, cleared on the next attempt. */
  error: string | null
}

export const initialAuthState: AuthState = { session: null, expired: false, error: null }

export function sessionFromLogin(resp: LoginResponse): Session {
  return { userId: resp.user_id, csrfToken: resp.csrf_token }
}

export function loggedIn(resp: LoginResponse): AuthState {
  return { session: sessionFromLogin(resp), expired: false, error: null }
}

export function loginFailed(message: string): AuthState {
  return { session: null, expired: false, error: message }
}

/** A 401 while authenticated: drop the session, flag expiry, keep no error. */
export function sessionExpired(): AuthState {
  return { session: null, expired: true, error: null }
}

/** True when an error is an expired/absent session (HTTP 401). */
export function isSessionExpired(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401
}
