/**
 * Minimal live-mode login gate (only rendered when LIVE_MODE and no session).
 *
 * Posts to /api/auth/login via useLiveSession; the session cookie is httpOnly
 * and the CSRF token is held in memory only. Shows the "session expired" notice
 * when a prior session 401'd mid-flow.
 */
import { useState, type FormEvent } from 'react'
import { Lock } from 'lucide-react'

export function LoginForm({
  onSubmit,
  error,
  expired,
}: {
  onSubmit: (username: string, password: string) => void
  error: string | null
  expired: boolean
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(username, password)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-slate-800/40 border border-slate-700/60 rounded-xl p-6">
        <div className="flex items-center gap-2 text-white">
          <Lock className="w-4 h-4 text-emerald-400" />
          <h1 className="text-lg font-bold font-display">ClearAuth — live sign in</h1>
        </div>
        {expired && (
          <p className="text-sm text-amber-400">Your session expired. Please log in again.</p>
        )}
        <label className="block text-sm">
          <span className="text-slate-400">Username</span>
          <input
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
