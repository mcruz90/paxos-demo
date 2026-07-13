/**
 * Fixture-derived case context for the selected live scenario.
 *
 * Explains WHY the run routes to a given tier: the criteria checklist carries
 * the same `status` + `confidence` the client sends as `criteria_results`, and
 * a low-confidence / needs_review criterion is exactly what parks a case at the
 * exception tier. Status → chip style is a lookup map (no if/else chain).
 */
import type { ScenarioConfig, CriterionStatus } from '../../../types'

const STATUS_CHIP: Record<CriterionStatus, string> = {
  found: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  needs_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  conflict: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_LABEL: Record<CriterionStatus, string> = {
  found: 'Found',
  needs_review: 'Needs review',
  conflict: 'Conflict',
}

export function CaseContextPanel({ scenario }: { scenario: ScenarioConfig }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Case context</p>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <span className="text-slate-500">Drug</span><span className="text-slate-200">{scenario.drug}</span>
        <span className="text-slate-500">Plan</span><span className="text-slate-200">{scenario.plan}</span>
        <span className="text-slate-500">Denial</span><span className="text-slate-300">{scenario.denialReason}</span>
      </div>
      <ul className="space-y-1.5">
        {scenario.criteriaResults.map((c, i) => (
          <li key={`${c.rule.label}-${i}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-300 min-w-0">{c.rule.label}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              {typeof c.confidence === 'number' && (
                <span className="text-xs text-slate-500 tabular-nums">{Math.round(c.confidence * 100)}%</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_CHIP[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
