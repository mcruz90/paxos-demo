import { useEffect, useRef, useState } from 'react'
import { Activity } from 'lucide-react'
import { type UnitCapability } from '../../capabilities'
import { resolvePatientContext } from '../../data/patientContext'
import { patientProfiles } from '../../data/patients'
import { type CaseStatus, type Client, type ScenarioConfig } from '../../types'
import { type LiveShellSession } from '../live/SessionGate'
import { openAppealPdf, openPaRequestPdf } from '../poc/letter'
import { CaseActionFooter } from './CaseActionFooter'
import { type LocalCaseState, checklistProgress, countLocallyResolved, unresolvedCriteria } from './caseQueue'
import { ChartQaTab } from './ChartQaTab'
import { type CriterionActions } from './CriterionRow'
import { type ExplicitCaseTransition } from './exceptionStatusTransition'
import { LetterGeneration } from './LetterGeneration'
import { LetterPreview } from './LetterPreview'
import { LiveLetterGeneration } from './LiveLetterGeneration'
import { PayerCounterOfferBanner } from './PayerCounterOfferBanner'
import { PreviewChecklistTab } from './PreviewChecklistTab'
import { buildQaSuggestions, sortCriteriaForReview } from './previewHelpers'
import { ensureSourceDocuments } from './sourceDocuments'

export type PreviewTab = 'letter' | 'checklist' | 'documents'

function PreviewTabBar({ isInitial, satisfied, total, docCount, activeTab, setActiveTab }: {
  isInitial: boolean; satisfied: number; total: number; docCount: number; activeTab: PreviewTab; setActiveTab: (t: PreviewTab) => void
}) {
  const tabs: { tab: PreviewTab; label: string }[] = [
    { tab: 'checklist', label: `1. Criteria Checklist (${satisfied}/${total})` },
    { tab: 'letter', label: `2. ${isInitial ? 'PA Packet' : 'Appeal Packet'}` },
    { tab: 'documents', label: `3. Chart Q&A & Activity Log (${docCount})` },
  ]
  return (
    <div className="px-6 pt-2.5 border-b border-slate-800 bg-slate-900/10 flex gap-5 shrink-0 overflow-x-auto">
      {tabs.map(item => (
        <button
          key={item.tab}
          id={item.tab === 'letter' ? 'tour-packet-tab' : undefined}
          type="button"
          onClick={() => setActiveTab(item.tab)}
          className={`pb-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === item.tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function PreviewPane({
  client, scenario, localState, actions, onQuickApprove, onPayerDecision, onSaveNarrative,
  pendingTransition, onConfirmStatusTransition,
  selectedCiteIndex, onSelectCiteIndex, activeTab, setActiveTab, activeDocId, onViewDoc, onOpenDisputeResolver, generateCap, live,
}: {
  client: Client | null; scenario: ScenarioConfig | null; localState: LocalCaseState; actions: CriterionActions
  onOpenCase?: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void; onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onSaveNarrative?: (text: string) => void; pendingTransition?: ExplicitCaseTransition | null; onConfirmStatusTransition?: () => void
  selectedCiteIndex: number | null; onSelectCiteIndex: (idx: number | null) => void
  activeTab: PreviewTab; setActiveTab: (tab: PreviewTab) => void; activeDocId: string | null; onViewDoc: (docId: string) => void
  onOpenDisputeResolver?: () => void; generateCap: UnitCapability; live?: LiveShellSession
}) {
  const [letterGen, setLetterGen] = useState<'idle' | 'review'>('idle')
  const [generatedLetter, setGeneratedLetter] = useState<string | undefined>(undefined)
  const [gateResolution, setGateResolution] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLetterGen('idle'); setGeneratedLetter(undefined); setGateResolution(null)
  }, [client?.id])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [activeTab, client?.id])

  if (!client || !scenario) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mb-4">
          <Activity className="w-6 h-6 text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-400">No case selected</p>
        <p className="text-xs text-slate-600 mt-1">Select a case from the PA Workqueue to open the Epic Storyboard &amp; Chart</p>
      </div>
    )
  }

  const isInitial = scenario.lifecycle === 'initial_pa'
  const unresolved = unresolvedCriteria(scenario)
  const hasUnresolvedRemaining = unresolved.length > 0 && countLocallyResolved(unresolved, localState) < unresolved.length
  const progress = checklistProgress(scenario, localState)
  const patientContext = resolvePatientContext(scenario, client)
  const scenarioWithContext = { ...scenario, patientContext }
  const docs = ensureSourceDocuments(scenario)
  const sortedCriteria = sortCriteriaForReview(scenario.criteriaResults, localState)
  const qaSuggestions = buildQaSuggestions(scenario, client.patientRef ? patientProfiles[client.patientRef] : undefined)
  const handlePrint = () => (isInitial ? openPaRequestPdf(scenarioWithContext) : openAppealPdf(scenarioWithContext))
  const handleGenDone = (draftText?: string, resolution?: string | null) => {
    setGeneratedLetter(draftText); setGateResolution(resolution ?? null); setLetterGen('review')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20 min-w-0">
      <div className="px-6 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-white shrink-0">{client.name}</span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-medium text-slate-300 truncate">{scenario.requestedTherapy || scenario.drug}</span>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{scenario.plan}</span>
      </div>

      {client.status !== 'processing' && (
        <PreviewTabBar isInitial={isInitial} satisfied={progress.satisfied} total={progress.total} docCount={docs.length} activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      {client.status === 'payer_response' && scenario.payerCounterOffer && (
        <PayerCounterOfferBanner
          offer={scenario.payerCounterOffer}
          scenario={scenario}
          onDispute={() => { if (onOpenDisputeResolver) onOpenDisputeResolver(); else { onPayerDecision(client.scenarioId, 'disputed'); setActiveTab('letter') } }}
          onAccept={() => onPayerDecision(client.scenarioId, 'accepted')}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 select-text">
        {activeTab === 'letter' ? (
          client.status === 'ready_for_review' && letterGen !== 'review' ? (
            generateCap === 'live' && live ? (
              <LiveLetterGeneration key={`${client.id}-live-gen`} scenario={scenario} csrfToken={live.csrfToken} onExpire={live.onExpire} onComplete={handleGenDone} />
            ) : (
              <LetterGeneration key={`${client.id}-gen`} onComplete={draft => handleGenDone(draft, null)} />
            )
          ) : (
            <LetterPreview
              scenario={scenarioWithContext} patientContext={patientContext} blocked={progress.satisfied < progress.total}
              onGoToChecklist={() => setActiveTab('checklist')} selectedCiteIndex={selectedCiteIndex} onSelectCiteIndex={onSelectCiteIndex}
              generatedLetter={generatedLetter} gateResolution={gateResolution} editedNarrative={localState.editedNarrative} onSaveNarrative={onSaveNarrative}
            />
          )
        ) : activeTab === 'documents' ? (
          <ChartQaTab client={client} scenario={scenario} docs={docs} qaSuggestions={qaSuggestions} activeDocId={activeDocId} onViewDoc={onViewDoc} activity={localState.activity} localState={localState} />
        ) : (
          <PreviewChecklistTab timeline={scenario.timeline} activity={localState.activity} sortedCriteria={sortedCriteria} progress={progress} localState={localState} actions={actions} selectedCiteIndex={selectedCiteIndex} onSelectCiteIndex={onSelectCiteIndex} />
        )}
        <div className="h-4" />
      </div>

      <CaseActionFooter
        client={client} scenario={scenario} hasUnresolvedRemaining={hasUnresolvedRemaining}
        letterOnScreen={activeTab === 'letter'} letterReviewed={letterGen === 'review'}
        pendingTransition={pendingTransition} onConfirmStatusTransition={onConfirmStatusTransition}
        onPrint={handlePrint} onQuickApprove={() => onQuickApprove(client.scenarioId)}
        onGoToLetter={() => setActiveTab('letter')} onViewActivity={() => setActiveTab('documents')}
      />
    </div>
  )
}
