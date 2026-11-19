import { FileCheck2 } from 'lucide-react'
import { DEFAULT_EVAL_SNAPSHOT } from '../../data/evalSnapshot'
import type { Dimension, EvalSnapshot } from '../../generated/evalSnapshotTypes'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

const KIND_CLS: Record<Dimension['kind'], string> = {
  deterministic: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  entailment: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  judge: 'text-violet-300 border-violet-500/30 bg-violet-500/10',
}

function calibrationCell(d: Dimension): string {
  if (!d.calibration) return '—'
  const kappa = d.calibration.kappa === null ? '—' : d.calibration.kappa.toFixed(2)
  return `n=${d.calibration.n} · κ=${kappa}`
}

export function SnapshotRubricDimensionsSection({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  if (!snapshot) return null
  const { appeal_rubric } = snapshot

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            Appeal Rubric Dimensions · appeal_rubric.json ({appeal_rubric.dimensions.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct snapshot contract from <span className="font-mono">clearauth-eval</span> — D1–D7 deterministic, E1–E2 entailment, J1–J4 defined-only judge.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={appeal_rubric.state} />
          <DecisionStatusBadge decision={appeal_rubric.decision} />
        </div>
      </div>

      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3.5 py-2.5 font-medium">Dimension ID</th>
              <th className="text-center px-3 py-2.5 font-medium">Kind</th>
              <th className="text-left px-3.5 py-2.5 font-medium">Question</th>
              <th className="text-center px-3 py-2.5 font-medium">State</th>
              <th className="text-right px-3.5 py-2.5 font-medium">Calibration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {appeal_rubric.dimensions.map(d => (
              <tr key={d.id} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-3.5 py-2.5 font-mono text-slate-200 whitespace-nowrap">{d.id}</td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono border ${KIND_CLS[d.kind]}`}>{d.kind}</span>
                </td>
                <td className="px-3.5 py-2.5 text-slate-300 leading-snug">{d.question}</td>
                <td className="px-3 py-2.5 text-center font-mono whitespace-nowrap">
                  <span className={d.state === 'measured' ? 'text-emerald-300' : 'text-violet-300'}>{d.state}</span>
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-slate-400 whitespace-nowrap">{calibrationCell(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
