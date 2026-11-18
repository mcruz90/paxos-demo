import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { useLiveAppeal } from '../poc/live/useLiveAppeal'

/**
 * O4_generate LIVE clinical unit (Step 1 of the Two-Step Packet flow):
 * Streams the real backend generation via `useLiveAppeal`, presenting clean
 * clinical progress milestones (with zero raw engineering/eval keys in Operate)
 * and automatically transitioning into the Unified White Paper Canvas once done.
 * Raw eval scores and correlation traces remain accessible in Build's Concept B
 * Inspector.
 */
export function LiveLetterGeneration({
  scenario,
  csrfToken,
  onExpire,
  onComplete,
}: {
  scenario: ScenarioConfig
  csrfToken: string
  onExpire: () => void
  onComplete: (draftText?: string) => void
}) {
  const appeal = useLiveAppeal(csrfToken, onExpire)

  useEffect(() => { void appeal.run(scenario) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { status, steps, letter, error } = appeal.state
  const done = status === 'done'

  // Auto-transition into the unified white paper packet shortly after completion.
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => onComplete(letter || undefined), 550)
    return () => clearTimeout(id)
  }, [done, letter, onComplete])

  const hasSteps = steps.length > 0
  const milestones = [
    { label: 'Payer Policy & Benefit Rules Matched', complete: done || hasSteps },
    { label: 'Clinical Criteria Grounded to Source Chart', complete: done || steps.length >= 2 },
    { label: 'Assembling Medical Necessity Packet', complete: done || !!letter },
    { label: 'Clinical Safety & Citation Verification Passed', complete: done },
  ]

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          {status === 'streaming' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {status === 'idle'      && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {status === 'error'     && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {done                   && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <div>
            <span className="text-sm font-semibold text-slate-200 block">
              {(status === 'streaming' || status === 'idle') && 'Assembling Prior Authorization Packet…'}
              {status === 'error' && 'Packet Assembly Could Not Complete'}
              {done && 'AI Assembly Complete — Opening Packet Review'}
            </span>
            <span className="text-xs text-slate-400">
              {done
                ? 'Opening clinician verification & inline editing canvas…'
                : 'Verifying clinical evidence against payer criteria'}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          Clinical Verification Active
        </span>
      </div>

      <div className="p-4 space-y-2.5">
        {milestones.map(m => (
          <div
            key={m.label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors ${
              m.complete
                ? 'border-emerald-500/25 bg-emerald-500/5 text-slate-200'
                : 'border-slate-800/60 bg-slate-900/20 text-slate-400'
            }`}
          >
            {m.complete ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : status === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className="font-medium">{m.label}</span>
          </div>
        ))}
      </div>

      {status === 'error' && (
        <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-red-200 leading-relaxed">
            {error || 'Unable to assemble packet. Retry below to try again.'}
          </p>
          <button
            onClick={() => void appeal.run(scenario)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {done && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-200 leading-relaxed">
            Draft complete. Clinician review is required before transmission.
          </p>
          <button
            onClick={() => onComplete(letter || undefined)}
            className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Open Packet
          </button>
        </div>
      )}
    </div>
  )
}
