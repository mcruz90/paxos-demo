import { Hammer } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  NOT_IN_SNAPSHOT,
  type NotBuiltId,
  findNotBuiltItem,
} from '../../data/evalSnapshot'
import type { EvalSnapshot } from '../../generated/evalSnapshotTypes'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

export function NotBuiltSnapshotCard({
  snapshot = DEFAULT_EVAL_SNAPSHOT,
  itemId,
  heading,
  compact = false,
}: {
  snapshot?: EvalSnapshot | null
  itemId: NotBuiltId
  heading: string
  compact?: boolean
}) {
  const section = snapshot?.not_built
  const item = findNotBuiltItem(snapshot, itemId)

  return (
    <div className={`rounded-xl border border-slate-700/60 bg-slate-800/40 ${compact ? 'p-4 space-y-2' : 'p-5 space-y-2.5'}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Hammer className="w-4 h-4 text-slate-400 shrink-0" />
          <h3 className={`font-semibold text-white ${compact ? 'text-xs' : 'text-sm'}`}>{heading}</h3>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SectionStateBadge state={section?.state ?? 'not_built'} />
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-600/60 bg-slate-900/60 text-slate-300 whitespace-nowrap">
            Not built in the harness
          </span>
          {!compact && <DecisionStatusBadge decision={section?.decision} />}
        </div>
      </div>

      {!item ? (
        <p className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</p>
      ) : (
        <div className="space-y-1">
          <p className={`font-medium text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}>{item.name}</p>
          <p className={`text-slate-400 leading-relaxed ${compact ? 'text-[11px]' : 'text-xs'}`}>{item.why}</p>
          {compact && <div className="pt-0.5"><DecisionStatusBadge decision={section?.decision} /></div>}
        </div>
      )}
    </div>
  )
}
