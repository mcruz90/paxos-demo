import { Database } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  type EvalSnapshot,
  NOT_IN_SNAPSHOT,
  formatCaseSetEntries,
  formatSnapshotSourceNote,
  formatStageCount,
} from '../../data/evalSnapshot'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

export function CaseSetsSnapshotCard({
  snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  snapshot?: EvalSnapshot | null
}) {
  const caseSets = snapshot?.case_sets

  if (!caseSets || caseSets.families.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Eval Case Set · case_sets</h2>
          </div>
          <span className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</span>
        </div>
        <p className="text-[11px] font-medium text-amber-300">{formatSnapshotSourceNote(snapshot)}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Eval Case Set · case_sets</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={caseSets.state} />
          <DecisionStatusBadge decision={caseSets.decision} />
        </div>
      </div>

      <p className="text-[11px] font-medium text-amber-300">{formatSnapshotSourceNote(snapshot)}</p>

      <div className="space-y-2.5">
        {caseSets.families.map(fam => {
          const kinds = formatCaseSetEntries(fam.by_kind)
          return (
            <div key={`${fam.family}-${fam.run_id}`} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-emerald-300">{fam.family}</span>
                  <span className="font-mono text-xs text-slate-300">{formatStageCount(fam.cases)} cases</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400">
                  {fam.run_id}{fam.created ? ` · ${fam.created}` : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kinds.map(([kind, count]) => (
                  <span
                    key={kind}
                    className="px-2 py-0.5 rounded border border-slate-700/60 bg-slate-950/60 font-mono text-[11px] text-slate-300"
                  >
                    {kind}: {formatStageCount(count)}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
