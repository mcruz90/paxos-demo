import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react'

// Simulated SSE letter generation — mirrors the live stream contract
// (ADR-0006): step events → token chunks → exactly one terminal event
// (done | error). The demo controls exercise the realistic failure states:
// a mid-stream connection drop (reconnect resumes with a bumped attempt —
// idempotent, no double audit write) and a server error (terminal `error`
// event recorded in the audit trail). Completion hands off to the letter
// review; generation is never auto-approved.
const STEP_EVENTS = [
  { at: 0.10, text: 'event: step · retrieval — policy pack resolved' },
  { at: 0.22, text: 'event: step · criteria — all criteria satisfied, assembling evidence' },
  { at: 0.34, text: 'event: step · synthesis — drafting letter' },
  { at: 0.80, text: 'event: step · gatekeeper — deterministic checks on model output' },
  { at: 0.92, text: 'event: step · audit — AuditRecord written before terminal event (ADR-0009)' },
  { at: 1.00, text: 'event: done · terminal · provenance: as_is' },
]

type Phase = 'streaming' | 'dropped' | 'error' | 'done'

export function LetterGeneration({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>('streaming')
  const [progress, setProgress] = useState(0)   // 0..1
  const [attempt, setAttempt] = useState(1)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => { if (timer.current) clearInterval(timer.current) }

  const run = () => {
    stop()
    setPhase('streaming')
    timer.current = setInterval(() => {
      setProgress(p => {
        const next = Math.min(1, p + 0.02)
        if (next >= 1) { stop(); setPhase('done') }
        return next
      })
    }, 90)
  }

  useEffect(() => { run(); return stop }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const log = STEP_EVENTS.filter(e => e.at <= progress)
  const streamingTokens = phase === 'streaming' && progress >= 0.34 && progress < 0.8

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {phase === 'streaming' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {phase === 'dropped'   && <WifiOff className="w-4 h-4 text-amber-400" />}
          {phase === 'error'     && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {phase === 'done'      && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span className="text-sm font-semibold text-slate-200">
            {phase === 'streaming' && 'Generating prior auth letter…'}
            {phase === 'dropped'   && 'Connection lost mid-stream'}
            {phase === 'error'     && 'Generation failed'}
            {phase === 'done'      && 'Letter generated — review required'}
          </span>
          <span className="text-xs text-slate-500 font-mono">attempt {attempt}</span>
        </div>
        {phase === 'streaming' && (
          <div className="flex gap-1.5" title="Demo controls — exercise the realistic SSE failure states">
            <button onClick={() => { stop(); setPhase('dropped') }}
              className="px-2 py-1 rounded text-[10px] font-semibold text-slate-500 border border-slate-800 hover:text-amber-300 hover:border-amber-500/30 transition-colors">
              simulate drop
            </button>
            <button onClick={() => { stop(); setPhase('error') }}
              className="px-2 py-1 rounded text-[10px] font-semibold text-slate-500 border border-slate-800 hover:text-red-300 hover:border-red-500/30 transition-colors">
              simulate error
            </button>
          </div>
        )}
      </div>

      {/* SSE event log */}
      <div className="px-4 py-3 font-mono text-[11px] space-y-1.5 min-h-[120px]">
        {log.map(e => (
          <p key={e.text} className={e.at >= 1 ? 'text-emerald-300' : 'text-slate-400'}>{e.text}</p>
        ))}
        {streamingTokens && (
          <p className="text-sky-300">
            event: token · chunk {Math.floor(progress * 180)} <span className="animate-pulse">▌</span>
          </p>
        )}
        {phase === 'dropped' && (
          <p className="text-amber-300">— stream closed without a terminal event (bare disconnect)</p>
        )}
        {phase === 'error' && (
          <p className="text-red-300">event: error · terminal · generic message to client, detail logged server-side (identifiers only)</p>
        )}
      </div>

      {/* Failure banners with the honest recovery contract */}
      {phase === 'dropped' && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3">
          <p className="text-xs text-amber-200 leading-relaxed mb-2.5">
            The connection dropped before a terminal event. Reconnecting retries with a bumped
            attempt — the idempotency key (case_id + attempt) guarantees no duplicate submission
            or double audit write.
          </p>
          <button
            onClick={() => { setAttempt(a => a + 1); setProgress(0.3); run() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect &amp; resume (attempt {attempt + 1})
          </button>
        </div>
      )}
      {phase === 'error' && (
        <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3">
          <p className="text-xs text-red-200 leading-relaxed mb-2.5">
            The run terminated with an <b>error</b> event and is recorded as such in the audit
            trail (one terminal per stream). Retrying starts a new attempt; it will not double-write.
          </p>
          <button
            onClick={() => { setAttempt(a => a + 1); setProgress(0); run() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry (attempt {attempt + 1})
          </button>
        </div>
      )}
      {phase === 'done' && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-200 leading-relaxed">
            Draft complete (provenance: <b>as_is</b>). A human must review the letter before it
            can be filed — approval is never automatic.
          </p>
          <button
            onClick={onComplete}
            className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Review letter
          </button>
        </div>
      )}
    </div>
  )
}
