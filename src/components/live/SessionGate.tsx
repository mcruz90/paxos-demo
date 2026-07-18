import { type ReactNode } from 'react'
import { useLiveSession } from '../poc/live/useLiveSession'
import { LoginForm } from '../poc/live/LoginForm'

/**
 * Live-mode session gate over the single product shell (ADR-0016).
 *
 * Mounted by App only when LIVE_MODE is set: the login form until a session
 * exists, then the shell via the render prop. Session state stays in memory
 * (never localStorage — PHI rule); `onExpire` is threaded to the data hooks so
 * a 401 mid-flow drops back to the login form instead of crashing.
 */
export interface LiveShellSession {
  csrfToken: string
  userId: string
  onLogout: () => void
  onExpire: () => void
}

export function SessionGate({ children }: { children: (live: LiveShellSession) => ReactNode }) {
  const { auth, doLogin, doLogout, expire } = useLiveSession()

  if (!auth.session) {
    return (
      <div className="flex h-screen bg-slate-950 text-white">
        <LoginForm onSubmit={doLogin} error={auth.error} expired={auth.expired} />
      </div>
    )
  }
  return (
    <>
      {children({
        csrfToken: auth.session.csrfToken,
        userId: auth.session.userId,
        onLogout: () => void doLogout(),
        onExpire: expire,
      })}
    </>
  )
}
