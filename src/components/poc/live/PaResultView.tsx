/**
 * Live initial-PA result panel — lifecycle-pure (renders `LivePaState` only).
 *
 * The CRD verdict (PA required / not required — early exit / unknown — needs a
 * person), the payer
 * determination when present, the PAS submission ref, and — when denied — the
 * appeal handoff note. Decision → chip style is a lookup map (no if/else chain).
 * Launching the appeal stays a separate, human-gated action (the appeal case).
 */
import { crdVerdictLabel, type LivePaState } from './paEvents'
import type { PaDecision } from '../../../types'
import { StepList } from './StepList'

const DECISION_CHIP: Record<PaDecision, string> = {
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pended: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  denied: 'bg-red-500/10 text-red-400 border-red-500/20',
}

export function PaResultView({ state }: { state: LivePaState }) {
  const { paRequired, outcome, appealHandoff } = state
  return (
    <div className="space-y-4">
      <StepList steps={state.steps} streaming={state.status === 'streaming'} />

      {state.error && <p className="text-sm text-rose-400">Submission failed: {state.error}</p>}

      {state.status === 'done' && paRequired && (
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-200">
              {crdVerdictLabel(paRequired.required)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{paRequired.basis}</p>
          </div>

          {outcome && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${DECISION_CHIP[outcome.decision]}`}>
                {outcome.decision}
              </span>
              <span className="text-slate-400">Determination <span className="text-slate-200 font-mono">{outcome.determinationId}</span></span>
              {outcome.timeToTherapy && <span className="text-slate-400">Time to therapy <span className="text-slate-200">{outcome.timeToTherapy}</span></span>}
            </div>
          )}
          {outcome?.note && <p className="text-sm text-slate-300">{outcome.note}</p>}

          {appealHandoff && (
            <p className="text-sm text-amber-400">
              Denial recorded — generate the appeal from the appeal case ({appealHandoff.caseRef}).
            </p>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-slate-500">
            {state.correlationId && <span>{state.correlationId}</span>}
            {state.submissionRef && <span>submission {state.submissionRef}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
