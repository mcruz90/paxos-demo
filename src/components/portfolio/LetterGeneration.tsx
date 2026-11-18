import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react'

// Clinical AI Assembly Progress Card (Step 1 of the Two-Step Packet flow).
// Displays clean clinical milestones instead of raw SSE event telemetry, and
// automatically transitions into the Unified White Paper Canvas once complete.
const CLINICAL_MILESTONES = [
  { at: 0.12, label: 'Payer Policy & Benefit Rules Matched' },
  { at: 0.30, label: 'Clinical Criteria Grounded to Source Chart' },
  { at: 0.55, label: 'Assembling Medical Necessity Packet' },
  { at: 0.85, label: 'Clinical Safety & Citation Verification Passed' },
]

type Phase = 'streaming' | 'dropped' | 'error' | 'done'

export function LetterGeneration({ onComplete }: { onComplete: (draftText?: string) => void }) {
  const [phase, setPhase] = useState<Phase>('streaming')
  const [progress, setProgress] = useState(0)
  const [attempt, setAttempt] = useState(1)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => { if (timer.current) clearInterval(timer.current) }

  const run = () => {
    stop()
    setPhase('streaming')
    timer.current = setInterval(() => {
      setProgress(p => {
        const next = Math.min(1, p + 0.04)
        if (next >= 1) { stop(); setPhase('done') }
        return next
      })
    }, 65)
  }

  useEffect(() => { run(); return stop }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-transition into the unified white paper packet after completion.
  useEffect(() => {
    if (phase !== 'done') return
    const id = setTimeout(() => onComplete(), 550)
    return () => clearTimeout(id)
  }, [phase, onComplete])

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          {phase === 'streaming' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {phase === 'dropped'   && <WifiOff className="w-4 h-4 text-amber-400" />}
          {phase === 'error'     && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {phase === 'done'      && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <div>
            <span className="text-sm font-semibold text-slate-200 block">
              {phase === 'streaming' && 'Assembling Prior Authorization Packet…'}
              {phase === 'dropped'   && 'Connection Interrupted During Assembly'}
              {phase === 'error'     && 'Packet Assembly Could Not Complete'}
              {phase === 'done'      && 'AI Assembly Complete — Opening Packet Review'}
            </span>
            <span className="text-xs text-slate-400">
              {phase === 'streaming' && 'Grounding every clinical criterion to the patient chart'}
              {phase === 'done'      && 'Opening clinician verification & inline editing canvas…'}
              {phase === 'dropped'   && `Attempt ${attempt} interrupted — safe to reconnect without duplicate filing`}
              {phase === 'error'     && 'Retry assembly below to resume'}
            </span>
          </div>
        </div>
        {phase === 'streaming' && (
          <div className="flex gap-1.5" title="Simulation controls">
            <button
              onClick={() => { stop(); setPhase('dropped') }}
              className="px-2 py-1 rounded text-[11px] font-medium text-slate-400 border border-slate-700 hover:text-amber-300 transition-colors"
            >
              Simulate drop
            </button>
            <button
              onClick={() => { stop(); setPhase('error') }}
              className="px-2 py-1 rounded text-[11px] font-medium text-slate-400 border border-slate-700 hover:text-red-300 transition-colors"
            >
              Simulate error
            </button>
          </div>
        )}
      </div>

      {/* Progress bar + clinical milestones */}
      <div className="p-4 space-y-4">
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="space-y-2">
          {CLINICAL_MILESTONES.map((m, idx) => {
            const done = progress >= m.at
            const active = !done && (idx === 0 || progress >= CLINICAL_MILESTONES[idx - 1].at)
            return (
              <div
                key={m.label}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
                  done
                    ? 'border-emerald-500/25 bg-emerald-500/5 text-slate-200'
                    : active
                      ? 'border-slate-700 bg-slate-800/40 text-slate-300'
                      : 'border-slate-800/60 bg-slate-900/20 text-slate-500'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <span className="font-medium">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {phase === 'dropped' && (
        <div className="mx-4 mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-200 leading-relaxed">
            The connection paused before completion. Reconnecting continues safely with no duplicate filing.
          </p>
          <button
            onClick={() => { setAttempt(a => a + 1); setProgress(0.3); run() }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-red-200 leading-relaxed">
            Packet assembly encountered an error. Retrying will start a clean attempt.
          </p>
          <button
            onClick={() => { setAttempt(a => a + 1); setProgress(0); run() }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-200 leading-relaxed">
            Clinical verification passed — clinician review required before filing.
          </p>
          <button
            onClick={() => onComplete()}
            className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Open Packet
          </button>
        </div>
      )}
    </div>
  )
}
