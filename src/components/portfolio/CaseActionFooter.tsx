import { AlertTriangle, Check, CheckCircle2, Clock, FileText, Printer, ScrollText } from 'lucide-react'
import { type Client, type ScenarioConfig } from '../../types'
import { type ExplicitCaseTransition } from './exceptionStatusTransition'

function PendingTransitionFooter({
  transition,
  onConfirm,
}: {
  transition: ExplicitCaseTransition
  onConfirm: () => void
}) {
  const isWaitingDocs = transition.nextStatus === 'awaiting_documentation'
  return (
    <div className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border ${
      isWaitingDocs ? 'bg-sky-500/10 border-sky-500/25' : 'bg-emerald-500/10 border-emerald-500/25'
    }`}>
      <p className={`text-xs leading-normal ${isWaitingDocs ? 'text-sky-300' : 'text-emerald-300'}`}>
        {transition.summary}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors ${
          isWaitingDocs ? 'bg-sky-600 hover:bg-sky-500' : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {transition.actionLabel}
      </button>
    </div>
  )
}

function ReadyForReviewFooter({
  letterOnScreen,
  letterReviewed,
  onPrint,
  onQuickApprove,
  onGoToLetter,
}: {
  letterOnScreen: boolean
  letterReviewed: boolean
  onPrint: () => void
  onQuickApprove: () => void
  onGoToLetter: () => void
}) {
  // The letter has been generated AND is on screen — only now can it be
  // filed. Approval is never reachable from the checklist alone.
  if (letterOnScreen && letterReviewed) {
    return (
      <div className="flex gap-3">
        <button type="button" onClick={onPrint} className="flex items-center gap-1.5 px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
        <button type="button" onClick={onQuickApprove} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors">
          <Check className="w-4 h-4" /> Approve &amp; File Prior Auth
        </button>
      </div>
    )
  }
  // All criteria addressed → next step is generating the letter for human review.
  return (
    <div className="flex items-center gap-3 p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
      <p className="flex-1 text-xs text-emerald-300 leading-normal">
        ✓ <strong>Criteria checklist complete.</strong> Assemble and review the packet before filing.
      </p>
      <button type="button" onClick={onGoToLetter} className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
        <FileText className="w-3.5 h-3.5" />
        {letterReviewed ? 'Review Packet' : 'Assemble Packet'}
      </button>
    </div>
  )
}

function StatusReceiptBar({
  client,
  scenario,
  onPrint,
  onViewActivity,
}: {
  client: Client
  scenario?: ScenarioConfig
  onPrint: () => void
  onViewActivity: () => void
}) {
  if (client.status === 'submitted') {
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-emerald-300 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">
            <strong>Prior Auth Submitted via Da Vinci PAS (X12 278)</strong>
            {scenario?.paOutcome ? ` · Determination ${scenario.paOutcome.determinationId} (${scenario.paOutcome.timeToTherapy})` : ''}
          </span>
        </div>
        <button type="button" onClick={onPrint} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition-colors">
          <Printer className="w-3.5 h-3.5" /> Print Receipt
        </button>
      </div>
    )
  }
  if (client.status === 'awaiting_documentation') {
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 bg-sky-500/10 border border-sky-500/25 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-sky-300 min-w-0">
          <Clock className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="truncate"><strong>Outbound Provider Query Dispatched</strong> — parked awaiting documentation response.</span>
        </div>
        <button type="button" onClick={onViewActivity} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/30 text-xs font-semibold text-sky-300 hover:bg-sky-500/15 transition-colors">
          <ScrollText className="w-3.5 h-3.5" /> Activity Log
        </button>
      </div>
    )
  }
  if (client.status === 'payer_response') {
    return (
      <div className="flex items-center justify-between gap-3 p-2.5 bg-violet-500/10 border border-violet-500/25 rounded-xl">
        <div className="flex items-center gap-2 text-xs text-violet-300 min-w-0">
          <AlertTriangle className="w-4 h-4 text-violet-400 shrink-0" />
          <span className="truncate"><strong>Payer Counter-Offer Received</strong> — dispute dosing or accept partial approval above.</span>
        </div>
      </div>
    )
  }
  return <p className="text-xs text-slate-400 text-center">Syncing clinical records from Epic FHIR…</p>
}

// Fixed action footer under the case workspace. The HITL contract lives here:
// filing is only reachable when the generated letter is on screen — never from
// the checklist alone, and never before generation has handed off to review.
export function CaseActionFooter({
  client, scenario, hasUnresolvedRemaining, letterOnScreen, letterReviewed, pendingTransition, onConfirmStatusTransition, onPrint, onQuickApprove, onGoToLetter, onViewActivity,
}: {
  client: Client; scenario?: ScenarioConfig; hasUnresolvedRemaining: boolean; letterOnScreen: boolean
  letterReviewed: boolean; pendingTransition?: ExplicitCaseTransition | null; onConfirmStatusTransition?: () => void
  onPrint: () => void; onQuickApprove: () => void; onGoToLetter: () => void; onViewActivity: () => void
}) {
  return (
    <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 shrink-0 select-none">
      {hasUnresolvedRemaining ? (
        <p className="text-xs text-slate-400 text-center">Resolve open clinical exceptions above before filing the submission packet.</p>
      ) : pendingTransition && onConfirmStatusTransition ? (
        <PendingTransitionFooter transition={pendingTransition} onConfirm={onConfirmStatusTransition} />
      ) : client.status === 'ready_for_review' ? (
        <ReadyForReviewFooter letterOnScreen={letterOnScreen} letterReviewed={letterReviewed} onPrint={onPrint} onQuickApprove={onQuickApprove} onGoToLetter={onGoToLetter} />
      ) : (
        <StatusReceiptBar client={client} scenario={scenario} onPrint={onPrint} onViewActivity={onViewActivity} />
      )}
    </div>
  )
}
