import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, ArrowLeft, Check, ExternalLink, FileText, Printer, ThumbsDown, ThumbsUp } from 'lucide-react'
import { type CaseStatus, type Client, type ScenarioConfig } from '../../types'
import { getCaseStage, getCaseTier } from '../../data/scenarios'
import { resolvePatientContext } from '../../data/patientContext'
import { DueBadge, StageBadge, StatusBadge, TierBadge } from '../ui'
import { CaseTimeline } from '../poc/CaseTimeline'
import { openAppealPdf, openPaRequestPdf } from '../poc/letter'
import { type LocalCaseState, checklistProgress, countLocallyResolved, unresolvedCriteria } from './caseQueue'
import { type CriterionActions, CriterionRow } from './CriterionRow'
import { DocumentsVault } from './DocumentsVault'
import { LetterGeneration } from './LetterGeneration'
import { LetterPreview } from './LetterPreview'

export type PreviewTab = 'letter' | 'checklist' | 'documents'

// Middle pane: the selected case's workspace — criteria checklist, letter
// preview, timeline, and the action footer for the case's current status.
export function PreviewPane({
  client,
  scenario,
  localState,
  actions,
  onOpenCase,
  onQuickApprove,
  onPayerDecision,
  onBackToQueue,
  selectedCiteIndex,
  onSelectCiteIndex,
  activeTab,
  setActiveTab,
  activeDocId,
  onViewDoc,
  onOpenDisputeResolver,
}: {
  client: Client | null
  scenario: ScenarioConfig | null
  localState: LocalCaseState
  actions: CriterionActions
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onBackToQueue: () => void
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  activeTab: PreviewTab
  setActiveTab: (tab: PreviewTab) => void
  activeDocId: string | null
  onViewDoc: (docId: string) => void
  // Opens the Exception Resolver in dispute mode (evidence packet for the
  // round-2 letter). Absent ⇒ the Dispute button applies the decision directly.
  onOpenDisputeResolver?: () => void
}) {
  // HITL gate: the letter must be generated (streamed) and reviewed before it
  // can be filed — 'idle' → 'generating' → 'review'. Resets per case.
  const [letterGen, setLetterGen] = useState<'idle' | 'generating' | 'review'>('idle')
  useEffect(() => { setLetterGen('idle') }, [client?.id])

  if (!client || !scenario) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
          <Activity className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-400">No case selected</p>
        <p className="text-xs text-slate-600 mt-1">Select a case on the left to review</p>
      </div>
    )
  }

  const stage = getCaseStage(client)
  const tier  = getCaseTier(client)

  const unresolved         = unresolvedCriteria(scenario)
  const totalResolvedCount = countLocallyResolved(unresolved, localState)
  const hasUnresolvedRemaining = unresolved.length > 0 && totalResolvedCount < unresolved.length

  // Display math: dispatched workflows are pending documentation, never
  // "satisfied" — only found criteria and clinician overrides count.
  const progress = checklistProgress(scenario, localState)

  const patientContext = resolvePatientContext(scenario, client)
  const scenarioWithContext = { ...scenario, patientContext }

  const handlePrint = () => {
    if (scenario.lifecycle === 'initial_pa') {
      openPaRequestPdf(scenarioWithContext)
    } else {
      openAppealPdf(scenarioWithContext)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20">
      {/* Header */}
      <div className="px-8 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBackToQueue}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Queue
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-base font-bold text-white">
                {client.patientDisplayName ?? client.name}
              </h2>
              <StageBadge stage={stage} />
              <StatusBadge status={client.status} />
              {tier !== 'routine' && <TierBadge tier={tier} />}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
              <span>{client.name}</span>
              {client.patientDob && (
                <><span className="text-slate-600">·</span><span>DOB {client.patientDob}</span></>
              )}
              {client.payer && (
                <><span className="text-slate-600">·</span><span>{client.payer}</span></>
              )}
              <span className="text-slate-600">·</span>
              <span className="truncate">{scenario.plan}</span>
            </div>
          </div>
          <DueBadge deadline={client.deadline} urgency={client.urgency} />
        </div>
      </div>

      {/* Tabs — always available except while the case is still importing */}
      {client.status !== 'processing' && (
        <div className="px-8 pt-3 border-b border-slate-800 bg-slate-900/10 flex gap-4 shrink-0">
          {([
            { tab: 'checklist', label: 'Criteria Checklist' },
            // The letter cannot be generated while any criterion is open —
            // dispatched-but-awaiting-docs included — so the tab locks, not
            // just the letter body behind it.
            { tab: 'letter',    label: 'Prior Auth Letter', locked: progress.satisfied < progress.total },
            ...(scenario.sourceDocuments?.length
              ? [{ tab: 'documents' as const, label: 'Documents' }]
              : []),
          ] as const).map(({ tab, label, ...rest }) => {
            const locked = 'locked' in rest && rest.locked
            return (
              <button
                key={tab}
                onClick={() => { if (!locked) setActiveTab(tab) }}
                disabled={locked}
                title={locked ? `Available once all criteria are satisfied (${progress.satisfied} of ${progress.total})` : undefined}
                className={[
                  'pb-2.5 text-xs font-semibold border-b-2 transition-all',
                  locked
                    ? 'border-transparent text-slate-700 cursor-not-allowed'
                    : activeTab === tab
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* Payer counter-offer — pinned above the scrollable workspace so the
          decision is never scrolled out of view; checklist stays reachable below */}
      {client.status === 'payer_response' && scenario.payerCounterOffer && (
        <div className="px-8 pt-4 shrink-0">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 space-y-2.5">
            <div className="flex items-start gap-3 select-none">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300 mb-0.5 uppercase tracking-wide">
                  Payer Counter-Offer · {scenario.payerCounterOffer.date}
                </p>
                <p className="text-sm text-slate-200 leading-snug">{scenario.payerCounterOffer.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (onOpenDisputeResolver) {
                    // Assemble the evidence packet first; the resolver applies
                    // the dispute and routes to the round-2 letter on confirm.
                    onOpenDisputeResolver()
                    return
                  }
                  onPayerDecision(client.scenarioId, 'disputed')
                  setActiveTab('letter')
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-sm font-semibold transition-colors"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Dispute Dosing
              </button>
              <button
                onClick={() => onPayerDecision(client.scenarioId, 'accepted')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-sm font-semibold transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Accept Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable workspace */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 select-text">
        {scenario.timeline && (
          <div className="pb-4 border-b border-slate-800/60 select-none">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Case Timeline
            </p>
            <CaseTimeline events={scenario.timeline} />
          </div>
        )}

        {/* Activity log — every coordinator action this session, with a copy of
            each outbound artifact. Demo-local stand-in for the audit rail
            (ADR-0009/0011): live mode maps entries to AuditRecords. */}
        {localState.activity.length > 0 && (
          <div className="pb-4 border-b border-slate-800/60">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 select-none">
              Activity Log
            </p>
            <div className="space-y-1.5">
              {localState.activity.map((entry, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-mono text-slate-500 shrink-0">{entry.at}</span>
                    <span className="font-semibold text-slate-200 shrink-0">{entry.action}</span>
                    <span className="text-slate-400 truncate">{entry.detail}</span>
                  </div>
                  {entry.artifact && (
                    <details className="mt-1.5">
                      <summary className="text-xs text-sky-300 cursor-pointer select-none hover:text-sky-200">
                        View sent artifact — {entry.artifact.title}
                      </summary>
                      <pre className="mt-1.5 text-[11px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">
                        {entry.artifact.body}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'letter' ? (
          // Ready-for-review cases stream the generation first (SSE contract,
          // incl. drop/error states), then hand off to human review. Other
          // statuses (e.g. payer-response round 2) keep the direct preview.
          client.status === 'ready_for_review' && letterGen !== 'review' ? (
            <LetterGeneration key={`${client.id}-gen`} onComplete={() => setLetterGen('review')} />
          ) : (
          <LetterPreview
            scenario={scenarioWithContext}
            patientContext={patientContext}
            blocked={progress.satisfied < progress.total}
            onGoToChecklist={() => setActiveTab('checklist')}
            selectedCiteIndex={selectedCiteIndex}
            onSelectCiteIndex={onSelectCiteIndex}
          />
          )
        ) : activeTab === 'documents' ? (
          <DocumentsVault
            documents={scenario.sourceDocuments ?? []}
            activeDocId={activeDocId}
            onViewDoc={onViewDoc}
          />
        ) : (
          <>
            {client.gapSummary && hasUnresolvedRemaining && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 select-none">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-0.5 uppercase tracking-wide">
                    Clinical Exception Summary
                  </p>
                  <p className="text-sm text-slate-200 leading-snug">{client.gapSummary}</p>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3 select-none">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Prior Auth Criteria Checklist
                </p>
                <span className="text-xs text-slate-500">
                  {progress.satisfied} of {progress.total} satisfied
                  {progress.awaitingDocs > 0 && (
                    <span className="text-amber-400"> · {progress.awaitingDocs} awaiting docs</span>
                  )}
                </span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-3 select-none flex">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${(progress.satisfied / progress.total) * 100}%`,
                    backgroundColor: progress.satisfied === progress.total ? '#10b981' : '#f59e0b',
                  }}
                />
                {/* Pending-docs segment renders dimmer — in flight, not done */}
                <div
                  className="h-full bg-amber-500/30 transition-all duration-500"
                  style={{ width: `${(progress.awaitingDocs / progress.total) * 100}%` }}
                />
              </div>
              <div className="space-y-2">
                {scenario.criteriaResults.map((criterion, i) => (
                  <CriterionRow
                    key={i}
                    criterion={criterion}
                    localState={localState}
                    actions={actions}
                    isSelected={selectedCiteIndex === i}
                    onSelect={() => onSelectCiteIndex(i)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <div className="h-4" />
      </div>

      {/* Fixed action footer */}
      <div className="px-8 py-4 border-t border-slate-800 bg-slate-900/50 shrink-0 select-none">
        {hasUnresolvedRemaining ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-center">
            <p className="text-xs text-amber-300 leading-normal">
              ⚠️ <strong>Exceptions blocking prior auth.</strong> Use the Criteria Checklist tab above to resolve exceptions.
            </p>
          </div>
        ) : client.status === 'ready_for_review' ? (
          activeTab === 'letter' && letterGen === 'review' ? (
            // The letter has been generated AND is on screen — only now can it
            // be filed. Approval is never reachable from the checklist alone.
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={() => onQuickApprove(client.scenarioId)}
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
                onClick={() => setActiveTab('letter')}
                className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
                {letterGen === 'review' ? 'Review Letter' : 'Generate Letter'}
              </button>
            </div>
          )
        ) : (
          <button
            onClick={() => onOpenCase(client.scenarioId, client.status)}
            className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors py-1"
          >
            <ExternalLink className="w-4 h-4" />
            View full documentation details
          </button>
        )}
      </div>
    </div>
  )
}
