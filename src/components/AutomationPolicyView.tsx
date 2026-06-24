import { Building2, Info, TrendingUp, History, CheckCircle } from 'lucide-react'
import { TENANT } from '../data/scenarios'
import { ReviewPolicyControl } from './ReviewPolicyControl'

const CHANGE_LOG = [
  { date: 'Jun 9, 2026',  who: 'M. Torres',  change: 'Sample rate: 1 in 10 → 1 in 5',       reason: 'Q2 audit found two routine cases with unsupported doses' },
  { date: 'May 14, 2026', who: 'M. Torres',  change: 'Auto-assemble enabled for Routine',     reason: 'Pilot complete — 98.2% accuracy over 30-day window' },
  { date: 'Apr 1, 2026',  who: 'ClearAuth',  change: 'Policy initialized at onboarding defaults', reason: '' },
]

export function AutomationPolicyView() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Automation Policy</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            How much routine volume to auto-assemble and queue vs. review in depth — your team owns this knob
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700"
          title={`Operating as ${TENANT.name} — ${TENANT.type}.`}
        >
          <Building2 className="w-3 h-3 text-slate-400" />
          <span className="text-slate-200 font-medium">{TENANT.name}</span>
        </span>
      </div>

      <div className="px-8 py-6 flex gap-6 items-start">
        {/* Left: policy controls */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              ClearAuth stands up the capability and a sensible default at onboarding; from here, your PA team adjusts the
              policy directly — no implementation ticket required. Changes apply to new cases entering the queue.
            </p>
          </div>
          <ReviewPolicyControl routineVolumePct={55} />
        </div>

        {/* Right: projected impact + change log */}
        <div className="w-72 shrink-0 space-y-4">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Projected impact</p>
            </div>
            <div className="space-y-3">
              {([
                { label: 'Auto-assembled volume', value: '≈ 55%', note: 'of all cases', color: 'text-emerald-300' },
                { label: 'Sampled for deep review', value: '1 in 5', note: 'of routine cases', color: 'text-amber-300' },
                { label: 'Coordinator time saved', value: '~2.3 hrs', note: 'per day per coordinator', color: 'text-violet-300' },
              ] as const).map(({ label, value, note, color }) => (
                <div key={label} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300 leading-tight">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{note}</p>
                  </div>
                  <span className={`text-sm font-bold font-mono shrink-0 ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">Human authorization required on every send — automation governs assembly depth, not transmission.</p>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Change log</p>
            </div>
            <div className="space-y-3">
              {CHANGE_LOG.map((entry, i) => (
                <div key={i} className="relative pl-3 border-l border-slate-700/60">
                  <p className="text-xs font-medium text-slate-300 leading-tight">{entry.change}</p>
                  {entry.reason && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.reason}</p>}
                  <p className="text-xs text-slate-600 mt-1">{entry.date} · {entry.who}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
