/**
 * Live pending-review queue panel (GET /api/reviews/pending).
 *
 * Metadata only — never letter text (PHI rule). Selecting a row opens it in the
 * resume surface. Refreshes after a resume completes (driven by the parent).
 */
import { Inbox } from 'lucide-react'
import { TierBadge } from '../../ui'
import type { PendingReviewItem } from '../../../lib/wire'

export function PendingQueue({
  reviews,
  activeId,
  onOpen,
}: {
  reviews: PendingReviewItem[]
  activeId: string | null
  onOpen: (item: PendingReviewItem) => void
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4 text-slate-400" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Pending review ({reviews.length})
        </p>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-500">No exception-tier cases awaiting review.</p>
      ) : (
        <ul className="space-y-2">
          {reviews.map(item => (
            <li key={item.correlation_id}>
              <button
                onClick={() => onOpen(item)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                  activeId === item.correlation_id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white font-medium">{item.drug}</p>
                  <TierBadge tier={item.tier} />
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{item.plan}</p>
                <p className="text-slate-600 text-xs mt-0.5 font-mono">{item.correlation_id}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
