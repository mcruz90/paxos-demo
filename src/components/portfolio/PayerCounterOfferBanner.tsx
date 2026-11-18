import { AlertTriangle, ThumbsDown, ThumbsUp } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { deriveCounterOfferComparison } from './chartQaHelpers'

function CounterOfferComparisonGrid({ scenario }: { scenario?: ScenarioConfig }) {
  const cmp = deriveCounterOfferComparison(scenario)
  if (!cmp) return null
  return (
    <div className="space-y-2 pt-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Prescribed Regimen · Weight-Adjusted</p>
          <p className="font-semibold text-slate-200 mt-0.5">{cmp.orderedRegimen}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{cmp.orderedClinicalBasis}</p>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-red-300">Payer Counter-Offer · Sub-Therapeutic</p>
          <p className="font-semibold text-slate-200 mt-0.5">{cmp.payerOfferRegimen}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{cmp.payerOfferGap}</p>
        </div>
      </div>
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-sky-500/25 bg-sky-500/10 text-sky-300">
        Guideline Floor · {cmp.guidelineFloor}
      </div>
    </div>
  )
}

export function PayerCounterOfferBanner({
  offer, scenario, onDispute, onAccept,
}: {
  offer: NonNullable<ScenarioConfig['payerCounterOffer']>; scenario?: ScenarioConfig; onDispute: () => void; onAccept: () => void
}) {
  return (
    <div className="px-6 pt-4 shrink-0">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-3">
        <div className="flex items-start gap-3 select-none">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-0.5 uppercase tracking-wide">Payer Counter-Offer · {offer.date}</p>
            <p className="text-sm text-slate-200 leading-snug">{offer.summary}</p>
          </div>
        </div>
        <CounterOfferComparisonGrid scenario={scenario} />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDispute}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-sm font-semibold transition-colors"
          >
            <ThumbsDown className="w-3.5 h-3.5" />Dispute Dosing
          </button>
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-sm font-semibold transition-colors"
          >
            <ThumbsUp className="w-3.5 h-3.5" />Accept Offer
          </button>
        </div>
      </div>
    </div>
  )
}
