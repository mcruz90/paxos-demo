import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { useLiveAppeal } from '../poc/live/useLiveAppeal'
import { formatPolicyMatch } from './letterNarrative'

/**
 * Compound capability chip (May's decision 2026-07-20). Neither a plain LIVE
 * nor a plain SIMULATED chip tells the truth here: the generation pipeline is
 * genuinely live, but the case it runs against is a simulated fixture
 * (O7_portfolio_queue_sim). The two-part chip states both, reusing
 * `CapabilityChip`'s live (emerald) / simulated (violet) palette so it reads as
 * consistent with the single-capability chips.
 */
function GenerationCapabilityChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider whitespace-nowrap">
      <span className="text-emerald-400">LIVE generation</span>
      <span className="text-slate-500">·</span>
      <span className="text-violet-300">demo case data</span>
    </span>
  )
}

/**
 * O4_generate LIVE unit (ADR-0016, Workstream SU slice 2): streams a real
 * appeal from the backend into the portfolio case workspace, replacing the
 * simulated `LetterGeneration` re-simulation whenever the manifest marks
 * `O4_generate` live.
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
  onComplete: (draftText?: string, gateResolution?: string | null) => void
}) {
  const appeal = useLiveAppeal(csrfToken, onExpire)

  // Start the real stream on mount. PreviewPane keys this per opened case, so a
  // fresh case is one run; the hook's attempt counter keeps a reconnect
  // idempotent (case_id + attempt — no double audit write).
  useEffect(() => { void appeal.run(scenario) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { status, steps, letter, error, done: doneEvent } = appeal.state
  const done = status === 'done'
  const policyMatch = done ? formatPolicyMatch(doneEvent?.pa_resolution) : 'Not evaluated'
  const isPolicyHold = done && doneEvent?.pa_resolution?.trim() === 'generic'

  const milestones = [
    { label: 'Payer Policy & Benefit Rules Matched', complete: done || steps.length > 0 },
    { label: 'Clinical Criteria Grounded to Source Chart', complete: done || steps.length >= 2 },
    { label: 'Assembling Medical Necessity Packet', complete: done || !!letter },
    { label: `Policy match: ${policyMatch}`, complete: done && !!doneEvent?.pa_resolution && !isPolicyHold },
  ]

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          {(status === 'streaming' || status === 'idle') && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
          {done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <div>
            <span className="text-sm font-semibold text-slate-200 block">
              {status === 'error' ? 'Packet Assembly Could Not Complete' : done ? 'Stream Complete — Clinician Review Required' : 'Assembling Prior Authorization Packet…'}
            </span>
            <span className="text-xs text-slate-400">
              {done ? 'Use Open Packet below after verifying status.' : 'Streaming live generation steps and artifact draft'}
            </span>
          </div>
        </div>
        <GenerationCapabilityChip />
      </div>

      <div className="p-4 space-y-2.5">
        {milestones.map(m => (
          <div key={m.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors ${m.complete ? 'border-emerald-500/25 bg-emerald-500/5 text-slate-200' : 'border-slate-800/60 bg-slate-900/20 text-slate-400'}`}>
            {m.complete ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />}
            <span className="font-medium">{m.label}</span>
          </div>
        ))}
      </div>

      {status === 'error' && (
        <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-red-200 leading-relaxed">{error || 'Unable to assemble packet. Retry below to try again.'}</p>
          <button type="button" onClick={() => void appeal.run(scenario)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {done && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-200 leading-relaxed">Draft complete. A human must review the packet before it can be filed — approval is never automatic.</p>
          <button type="button" onClick={() => onComplete(letter || undefined, doneEvent?.pa_resolution || null)} className="shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
            Open Packet
          </button>
        </div>
      )}
    </div>
  )
}
