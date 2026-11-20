import { ShieldAlert } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  type EvalSnapshot,
  NOT_IN_SNAPSHOT,
  formatStageCount,
  formatWilsonRange,
} from '../../data/evalSnapshot'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

export function RedTeamSnapshotCard({
  snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  snapshot?: EvalSnapshot | null
}) {
  const redteam = snapshot?.redteam

  if (!redteam || redteam.kinds.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Red-Team Probes · redteam</h2>
        </div>
        <span className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Red-Team Probes · Held vs. Not Held</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={redteam.state} />
          <DecisionStatusBadge decision={redteam.decision} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
        <span>run_id: {redteam.run_id ?? NOT_IN_SNAPSHOT}</span>
        {redteam.created && <span>· {redteam.created}</span>}
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-400 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3.5 py-2.5 font-medium">Set Kind</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Held / n</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Not Held</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Wilson 95% CI (Not Held)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40 font-mono">
            {redteam.kinds.map(k => (
              <tr key={k.kind} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-3.5 py-2.5 text-slate-200">{k.kind}</td>
                <td className="px-3.5 py-2.5 text-right text-slate-200 whitespace-nowrap">
                  {formatStageCount(k.held)} / {formatStageCount(k.n)}
                </td>
                <td className={`px-3.5 py-2.5 text-right whitespace-nowrap font-semibold ${k.not_held === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {formatStageCount(k.not_held)}
                </td>
                <td className="px-3.5 py-2.5 text-right text-slate-400 whitespace-nowrap">
                  {formatWilsonRange(k.not_held_range95)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
