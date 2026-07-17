import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { type ScenarioConfig } from '../../types'

// Payer counter-offer decision strip — pinned above the scrollable workspace
// so the decision is never scrolled out of view. The dispute action is owned
// by the parent (it may open the dispute resolver first).
export function PayerCounterOfferBanner({
  offer,
  onDispute,
  onAccept,
}: {
  offer: NonNullable<ScenarioConfig['payerCounterOffer']>
  onDispute: () => void
  onAccept: () => void
}) {
  return (
    <div className="px-8 pt-4 shrink-0">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 space-y-2.5">
        <div className="flex items-start gap-3 select-none">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-0.5 uppercase tracking-wide">
              Payer Counter-Offer · {offer.date}
            </p>
            <p className="text-sm text-slate-200 leading-snug">{offer.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDispute}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-sm font-semibold transition-colors"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            Dispute Dosing
          </button>
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-sm font-semibold transition-colors"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Accept Offer
          </button>
        </div>
      </div>
    </div>
  )
}
