import { useEffect } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { useLiveAppeal } from '../poc/live/useLiveAppeal'
import { GenerateView } from '../poc/live/GenerateView'

/**
 * O4_generate LIVE unit (ADR-0016, Workstream SU slice 2): streams a real
 * appeal from the backend into the portfolio case workspace, replacing the
 * simulated `LetterGeneration` re-simulation whenever the manifest marks
 * `O4_generate` live.
 *
 * Thin by contract — it drives the already-tested `useLiveAppeal` hook and
 * renders the existing live presentational units through `GenerateView`
 * (StepList + drafted-letter block + DonePanel); it never duplicates their
 * internals and never reads mode. The shell (`PreviewPane`) decides live vs.
 * simulated from the manifest and only mounts this unit when live.
 *
 * Handoff mirrors the simulated unit: on the `done` terminal the reviewer
 * clicks through to human review — generation is never auto-approved (the HITL
 * gate is the review step, not this stream).
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
  onComplete: () => void
}) {
  const appeal = useLiveAppeal(csrfToken, onExpire)

  // Start the real stream on mount. PreviewPane keys this per opened case, so a
  // fresh case is one run; the hook's attempt counter keeps a reconnect
  // idempotent (case_id + attempt — no double audit write).
  useEffect(() => { void appeal.run(scenario) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { status } = appeal.state
  const done = status === 'done'

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {status === 'streaming' && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
          {status === 'error' && <CheckCircle2 className="w-4 h-4 text-red-400" />}
          {done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span className="text-sm font-semibold text-slate-200">
            {status === 'streaming' && 'Generating prior auth letter…'}
            {status === 'error' && 'Generation failed'}
            {done && 'Letter generated — review required'}
            {status === 'idle' && 'Starting generation…'}
          </span>
        </div>
        <GenerationCapabilityChip />
      </div>

      <div className="px-4 py-3">
        <GenerateView state={appeal.state} />
      </div>

      {done && (
        <div className="mx-4 mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-200 leading-relaxed">
            Draft complete. A human must review the letter before it can be filed — approval is never automatic.
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
