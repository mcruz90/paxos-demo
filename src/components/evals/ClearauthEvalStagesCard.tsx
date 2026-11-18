import { CheckCircle2, Layers } from 'lucide-react'
import { CLEARAUTH_EVAL_STAGES, DUAL_REVIEWER_KAPPA } from '../inspector/inspectorModel'
import { CapabilityChip } from '../live/CapabilityChip'

export function ClearauthEvalStagesCard() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">clearauth-eval · 6-Stage Pipeline &amp; Reviewer Calibration</h2>
          <CapabilityChip cap="simulated" />
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Dual-Reviewer κ = {DUAL_REVIEWER_KAPPA.kappa} ({DUAL_REVIEWER_KAPPA.agreementPct}% on n={DUAL_REVIEWER_KAPPA.sampleCriteria} · Stage 5 Target ≥ {DUAL_REVIEWER_KAPPA.targetKappa})
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Illustrative 6-stage harness benchmark with sample counts (n), 95% confidence intervals, and {DUAL_REVIEWER_KAPPA.graduatedEdits} graduated `human_edited` regression cases.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CLEARAUTH_EVAL_STAGES.map(st => (
          <div key={st.module} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">{st.stage}</span>
              <span className="text-xs font-mono font-bold text-emerald-300">{st.scorePct}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{st.module}</span>
              <span>n={st.n} · 95% CI {st.ci95}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{st.note}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
