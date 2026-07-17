import { type Client, type PaTargetType } from '../../types'
import { getCaseStage } from '../../data/scenarios'
import { DueBadge, StageBadge, StatusBadge } from '../ui'

// Gemini-roster idiom: a tiny uppercase tag for what the PA targets. All cases
// today are medications; the badge future-proofs device/procedure lifecycles.
const TARGET_BADGE: Record<PaTargetType, { label: string; cls: string }> = {
  medication: { label: 'MEDS',   cls: 'bg-slate-800 border-slate-700 text-slate-400' },
  device:     { label: 'DEVICE', cls: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
  procedure:  { label: 'PROC',   cls: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
}

// Compact case card for the queue's left pane. Two lines, minimal required
// info (roster-scan idiom): identity + status chip, then drug · payer with the
// stage and deadline. The per-case gap summary lives in the hover tooltip and
// the workspace — not on the card, where it overwhelmed the scan. The tier
// badge is dropped here: for exceptions it duplicated the status chip
// (badge fatigue), and the workspace header still shows it.
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
  const target = TARGET_BADGE[client.paTargetType ?? 'medication']

  const accentCls =
    client.urgency === 'today' ? 'border-l-red-500'
    : client.urgency === 'soon'  ? 'border-l-amber-500'
    : 'border-l-slate-600'

  return (
    <button
      id={tourId}
      onClick={onClick}
      title={client.gapSummary}
      className={[
        'w-full text-left border-l-2 px-4 py-3.5 rounded-r-xl transition-all relative',
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

      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-sm font-semibold text-white truncate leading-tight min-w-0">
          {client.patientDisplayName ?? client.name}
        </p>
        <StatusBadge status={client.status} />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 truncate min-w-0">
          {client.drug}{client.payer ? ` · ${client.payer}` : ''}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold tracking-wide ${target.cls}`}>
            {target.label}
          </span>
          <StageBadge stage={stage} />
          <DueBadge deadline={client.deadline} urgency={client.urgency} />
        </span>
      </div>
    </button>
  )
}
