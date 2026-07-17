import { Check, ExternalLink, FileText, Printer } from 'lucide-react'
import { type Client } from '../../types'

// Fixed action footer under the case workspace. The HITL contract lives here:
// filing is only reachable when the generated letter is on screen — never from
// the checklist alone, and never before generation has streamed to review.
export function CaseActionFooter({
  client,
  hasUnresolvedRemaining,
  letterOnScreen,
  letterReviewed,
  onPrint,
  onQuickApprove,
  onGoToLetter,
  onOpenCase,
}: {
  client: Client
  hasUnresolvedRemaining: boolean
  // The letter tab is active (the reviewed letter is what the user is seeing).
  letterOnScreen: boolean
  // Generation has completed and handed off to review.
  letterReviewed: boolean
  onPrint: () => void
  onQuickApprove: () => void
  onGoToLetter: () => void
  onOpenCase: () => void
}) {
  return (
    <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/50 shrink-0 select-none">
      {hasUnresolvedRemaining ? (
        <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-center">
          <p className="text-xs text-amber-300 leading-normal">
            ⚠️ <strong>Exceptions blocking prior auth.</strong> Use the Criteria Checklist tab above to resolve exceptions.
          </p>
        </div>
      ) : client.status === 'ready_for_review' ? (
        letterOnScreen && letterReviewed ? (
          // The letter has been generated AND is on screen — only now can it
          // be filed. Approval is never reachable from the checklist alone.
          <div className="flex gap-3">
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onQuickApprove}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 transition-colors"
            >
              <Check className="w-4 h-4" />
              Approve &amp; File Prior Auth
            </button>
          </div>
        ) : (
          // All criteria satisfied → the obvious next step is generating the
          // letter for human review, not filing. One CTA, no shortcut.
          <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
            <p className="flex-1 text-xs text-emerald-200 leading-normal">
              ✓ <strong>All criteria satisfied.</strong> Generate the prior auth letter — a human
              review of the letter is required before it can be filed.
            </p>
            <button
              onClick={onGoToLetter}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              <FileText className="w-4 h-4" />
              {letterReviewed ? 'Review Letter' : 'Generate Letter'}
            </button>
          </div>
        )
      ) : (
        <button
          onClick={onOpenCase}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
        >
          <ExternalLink className="w-4 h-4" />
          View full documentation details
        </button>
      )}
    </div>
  )
}
