/**
 * Live auth session held in React state (never localStorage — PHI rule).
 *
 * Wraps the api.ts login/logout calls onto the pure `session.ts` transitions.
 * `expire()` is called by the data hooks when a request 401s mid-flow, so an
 * expired session surfaces as a "log in again" state instead of a crash.
 */
import { useCallback, useState } from 'react'
import { ApiError, login, logout } from '../../../lib/api'
import {
  initialAuthState,
  loggedIn,
  loginFailed,
  sessionExpired,
  type AuthState,
} from './session'

export interface LiveSession {
  auth: AuthState
  doLogin: (username: string, password: string) => Promise<void>
  doLogout: () => Promise<void>
  expire: () => void
}

export function useLiveSession(): LiveSession {
  const [auth, setAuth] = useState<AuthState>(initialAuthState)

  const doLogin = useCallback(async (username: string, password: string) => {
    try {
      setAuth(loggedIn(await login({ username, password })))
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 401 ? 'Invalid credentials' : 'Login failed'
      setAuth(loginFailed(msg))
    }
  }, [])

  const doLogout = useCallback(async () => {
    // Best-effort server-side teardown; the local session clears regardless.
    if (auth.session) await logout({ csrfToken: auth.session.csrfToken }).catch(() => {})
    setAuth(initialAuthState)
  }, [auth.session])

  const expire = useCallback(() => setAuth(sessionExpired()), [])

  return { auth, doLogin, doLogout, expire }
}
