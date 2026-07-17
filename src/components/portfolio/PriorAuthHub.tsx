import { type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react'
import { type PaTargetType } from '../../types'
import { getCaseStage } from '../../data/scenarios'
import { StageBadge, StatusBadge } from '../ui'
import { type PaHistoryEntry, type Patient } from './patient'

const TARGET_BADGE: Record<PaTargetType, { label: string; cls: string }> = {
  medication: { label: 'MEDS',   cls: 'bg-slate-800 border-slate-700 text-slate-400' },
  device:     { label: 'DEVICE', cls: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
  procedure:  { label: 'PROC',   cls: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
}

const DECISION: Record<PaHistoryEntry['decision'], { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  approved:  { label: 'Approved',  cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', Icon: CheckCircle2 },
  denied:    { label: 'Denied',    cls: 'text-red-300 bg-red-500/10 border-red-500/25',             Icon: XCircle },
  withdrawn: { label: 'Withdrawn', cls: 'text-slate-400 bg-slate-800 border-slate-700',             Icon: Clock },
}

// The patient's Prior Auth Hub: every PA the patient carries — active cases
// (openable into the case workspace) and prior authorizations (read-only
// summary history). The active case's workspace renders below.
export function PriorAuthHub({
  patient,
  activeScenarioId,
  history,
  onSelectCase,
  workspace,
}: {
  patient: Patient
  activeScenarioId: string
  history: PaHistoryEntry[]
  onSelectCase: (scenarioId: string) => void
  workspace: ReactNode
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 shrink-0 overflow-y-auto max-h-[40%]">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
          Prior Authorizations · {patient.cases.length + history.length} total
        </p>

        <div className="space-y-2">
          {patient.cases.map(c => {
            const target = TARGET_BADGE[c.paTargetType ?? 'medication']
            const active = c.scenarioId === activeScenarioId
            return (
              <button
                key={c.id}
                onClick={() => onSelectCase(c.scenarioId)}
                className={[
                  'w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  active ? 'bg-slate-700/60 border-slate-600' : 'bg-slate-800/30 border-slate-800 hover:border-slate-700',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">{c.drug}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${target.cls}`}>{target.label}</span>
                    <StageBadge stage={getCaseStage(c)} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{c.name} · {c.payer}</p>
                </div>
                <StatusBadge status={c.status} />
                <ChevronRight className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
            )
          })}

          {history.map((h, i) => {
            const target = TARGET_BADGE[h.targetType]
            const d = DECISION[h.decision]
            return (
              <div key={i} className="w-full flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-900/30 px-4 py-3 opacity-90">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-300 truncate">{h.drug}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold ${target.cls}`}>{target.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Filed {h.filedDate}{h.determinationId ? ` · ${h.determinationId}` : ''}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-md border px-2 py-1 ${d.cls}`}>
                  <d.Icon className="w-3.5 h-3.5" /> {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Active case workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">{workspace}</div>
    </div>
  )
}
