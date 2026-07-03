import { User } from 'lucide-react'
import { type Client } from '../../types'
import { getCaseStage, getCaseTier } from '../../data/scenarios'
import { DueBadge, StageBadge, StatusBadge, TierBadge } from '../ui'

// Compact case card for the queue's left pane.
export function CaseCard({
  client,
  selected,
  onClick,
  tourId,
  isResolved,
}: {
  client: Client
  selected: boolean
  onClick: () => void
  tourId?: string
  isResolved: boolean
}) {
  const stage = getCaseStage(client)
  const tier  = getCaseTier(client)

  const accentCls =
    client.urgency === 'today' ? 'border-l-red-500'
    : client.urgency === 'soon'  ? 'border-l-amber-500'
    : 'border-l-slate-600'

  return (
    <button
      id={tourId}
      onClick={onClick}
      className={[
        'w-full text-left border-l-2 px-3 py-3 rounded-r-xl transition-all relative',
        accentCls,
        selected
          ? 'bg-slate-700/70 shadow-inner ring-1 ring-slate-600/60'
          : 'bg-slate-800/30 border-transparent hover:bg-slate-800/60 hover:ring-1 hover:ring-slate-700/40',
      ].join(' ')}
    >
      {isResolved && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 animate-pulse" title="All exceptions resolved locally" />
        </span>
      )}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md shrink-0 bg-slate-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {client.patientDisplayName ?? client.name}
            </p>
            <p className="text-xs text-slate-500 leading-tight">
              {client.name}{client.patientDob ? ` · ${client.patientDob}` : ''}
            </p>
          </div>
        </div>
        <DueBadge deadline={client.deadline} urgency={client.urgency} />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-1.5 ml-8">
        {client.payer && <span className="text-xs text-slate-400 font-medium">{client.payer}</span>}
        {client.payer && <span className="text-slate-600 text-xs">·</span>}
        <span className="text-xs text-slate-300">{client.drug}</span>
        <span className="text-slate-600 text-xs">·</span>
        <StageBadge stage={stage} />
      </div>

      {client.gapSummary && (
        <p className="text-xs text-slate-400 ml-8 leading-snug line-clamp-2">
          {client.gapSummary}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-1.5 ml-8">
        <StatusBadge status={client.status} />
        {tier !== 'routine' && <TierBadge tier={tier} />}
      </div>
    </button>
  )
}
