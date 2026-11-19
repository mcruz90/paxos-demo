import { Clock, Layers } from 'lucide-react'
import { EVAL_SNAPSHOT_PLACEHOLDER } from '../inspector/inspectorModel'

export function ClearauthEvalStagesCard() {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">clearauth-eval · Pipeline Readiness &amp; Calibration Snapshot</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border border-slate-600/60 bg-slate-900/60 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {EVAL_SNAPSHOT_PLACEHOLDER.state} · awaiting eval_snapshot.json
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        No <span className="font-mono text-slate-300">eval_snapshot.json</span> is connected yet. Stage readiness verdicts (
        <span className="font-mono text-slate-300">targets.json</span>), E2E chain blame, paired prompt diffs, and clinician calibration will load from one harness-generated JSON snapshot — zero hardcoded scores. Held-out sets remain one-shot with rotation (Decision 0004).
      </p>
    </div>
  )
}
