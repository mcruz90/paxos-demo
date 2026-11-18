import { useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { type CaseStatus, type Client, type ScenarioConfig } from '../../types'
import { resolvePatientContext } from '../../data/patientContext'
import { patientProfiles } from '../../data/patients'
import { CaseTimeline } from '../poc/CaseTimeline'
import { openAppealPdf, openPaRequestPdf } from '../poc/letter'
import { type LocalCaseState, checklistProgress, countLocallyResolved, unresolvedCriteria } from './caseQueue'
import { ActivityLog } from './ActivityLog'
import { CaseActionFooter } from './CaseActionFooter'
import { PayerCounterOfferBanner } from './PayerCounterOfferBanner'
import { type CriterionActions, CriterionRow } from './CriterionRow'
import { DocumentsVault } from './DocumentsVault'
import { FixtureChat } from './FixtureChat'
import { LetterGeneration } from './LetterGeneration'
import { LiveLetterGeneration } from './LiveLetterGeneration'
import { LetterPreview } from './LetterPreview'
import { ensureSourceDocuments } from './sourceDocuments'
import { type UnitCapability } from '../../capabilities'
import { type LiveShellSession } from '../live/SessionGate'

export type PreviewTab = 'letter' | 'checklist' | 'documents'

// Center pane of the 3-column clinical layout: compact case bar + 3 horizontal
// activity tabs ([1. Criteria Checklist] [2. PA / Appeal Packet] [3. Chart Q&A & Activity Log]).
export function PreviewPane({
  client,
  scenario,
  localState,
  actions,
  onOpenCase,
  onQuickApprove,
  onPayerDecision,
  onSaveNarrative,
  selectedCiteIndex,
  onSelectCiteIndex,
  activeTab,
  setActiveTab,
  activeDocId,
  onViewDoc,
  onOpenDisputeResolver,
  generateCap,
  live,
}: {
  client: Client | null
  scenario: ScenarioConfig | null
  localState: LocalCaseState
  actions: CriterionActions
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onSaveNarrative?: (text: string) => void
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  activeTab: PreviewTab
  setActiveTab: (tab: PreviewTab) => void
  activeDocId: string | null
  onViewDoc: (docId: string) => void
  onOpenDisputeResolver?: () => void
  generateCap: UnitCapability
  live?: LiveShellSession
}) {
  // HITL gate: the packet must complete step 1 assembly before step 2 paper
  // review/filing. Resets whenever the selected case changes.
  const [letterGen, setLetterGen] = useState<'idle' | 'review'>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setLetterGen('idle') }, [client?.id])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [activeTab, client?.id])

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

  const unresolved         = unresolvedCriteria(scenario)
  const totalResolvedCount = countLocallyResolved(unresolved, localState)
  const hasUnresolvedRemaining = unresolved.length > 0 && totalResolvedCount < unresolved.length

  const progress = checklistProgress(scenario, localState)
  const patientContext = resolvePatientContext(scenario, client)
  const scenarioWithContext = { ...scenario, patientContext }
  const docs = ensureSourceDocuments(scenario)

  const profile = client.patientRef ? patientProfiles[client.patientRef] : undefined
  const qaSuggestions: { q: string; a: string }[] = []
  if (profile?.trials?.length && profile.compliance) {
    qaSuggestions.push({
      q: 'Verify prior therapy trial',
      a: `${profile.trials.length} verified records on file (e.g. ${profile.trials[0].therapy}, ${profile.trials[0].facility}); PDC ${profile.compliance.pdc} over ${profile.compliance.durationDays} days.`,
    })
  }
  if (profile?.clinical?.diagnoses.length) {
    const dx = profile.clinical.diagnoses[0]
    qaSuggestions.push({
      q: 'Confirm primary diagnosis',
      a: `${dx.label}${dx.code ? ` (${dx.code})` : ''}${dx.since ? `, documented since ${dx.since}` : ''}.`,
    })
  }
  if (scenario.criteriaResults[0]) {
    const firstCrit = scenario.criteriaResults[0]
    const cite = scenario.citations[firstCrit.rule.label]
    if (cite) {
      qaSuggestions.push({
        q: `Summarize ${firstCrit.docSource}`,
        a: `${cite.source} (${cite.page}): "${cite.text}"`,
      })
    }
  }

  const handlePrint = () => {
    if (isInitial) {
      openPaRequestPdf(scenarioWithContext)
    } else {
      openAppealPdf(scenarioWithContext)
    }
  }

  // Sort unresolved criteria to the top (conflict -> needs_review -> satisfied)
  // while keeping each criterion's original index so citations stay synchronized.
  const sortedCriteria = scenario.criteriaResults
    .map((criterion, origIdx) => ({ criterion, origIdx }))
    .sort((a, b) => {
      const rank = (c: typeof a.criterion) => {
        const isResolved =
          localState.overrides[c.rule.label] !== undefined ||
          localState.dispatched.includes(c.rule.label)
        if (isResolved || c.status === 'found') return 2
        return c.status === 'conflict' ? 0 : 1
      }
      return rank(a.criterion) - rank(b.criterion)
    })

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/20 min-w-0">
      {/* Compact Single-Line Case Header (Patient identity + SLA live in the Left Epic Storyboard) */}
      <div className="px-6 py-2.5 border-b border-slate-800 shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-white shrink-0">{client.name}</span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-medium text-slate-300 truncate">{scenario.requestedTherapy || scenario.drug}</span>
        </div>
        <span className="text-xs text-slate-500 shrink-0">{scenario.plan}</span>
      </div>

      {/* 3 Clean Horizontal Activity Tabs */}
      {client.status !== 'processing' && (
        <div className="px-6 pt-2.5 border-b border-slate-800 bg-slate-900/10 flex gap-5 shrink-0 overflow-x-auto">
          {([
            { tab: 'checklist' as const, label: `1. Criteria Checklist (${progress.satisfied}/${progress.total})` },
            {
              tab: 'letter' as const,
              label: `2. ${isInitial ? 'PA Packet' : 'Appeal Packet'}`,
              locked: progress.satisfied < progress.total,
            },
            { tab: 'documents' as const, label: `3. Chart Q&A & Activity Log (${docs.length})` },
          ]).map(item => {
            const locked = 'locked' in item && item.locked
            return (
              <button
                key={item.tab}
                onClick={() => { if (!locked) setActiveTab(item.tab) }}
                disabled={locked}
                title={locked ? `Available once all criteria are satisfied (${progress.satisfied} of ${progress.total})` : undefined}
                className={[
                  'pb-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap',
                  locked
                    ? 'border-transparent text-slate-600 cursor-not-allowed opacity-70'
                    : activeTab === item.tab
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {item.label}{locked ? ' 🔒' : ''}
              </button>
            )
          })}
        </div>
      )}

      {client.status === 'payer_response' && scenario.payerCounterOffer && (
        <PayerCounterOfferBanner
          offer={scenario.payerCounterOffer}
          onDispute={() => {
            if (onOpenDisputeResolver) {
              onOpenDisputeResolver()
              return
            }
            onPayerDecision(client.scenarioId, 'disputed')
            setActiveTab('letter')
          }}
          onAccept={() => onPayerDecision(client.scenarioId, 'accepted')}
        />
      )}

      {/* Scrollable workspace */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4 select-text">
        {activeTab === 'letter' ? (
          client.status === 'ready_for_review' && letterGen !== 'review' ? (
            generateCap === 'live' && live ? (
              <LiveLetterGeneration
                key={`${client.id}-live-gen`}
                scenario={scenario}
                csrfToken={live.csrfToken}
                onExpire={live.onExpire}
                onComplete={() => setLetterGen('review')}
              />
            ) : (
              <LetterGeneration key={`${client.id}-gen`} onComplete={() => setLetterGen('review')} />
            )
          ) : (
            <LetterPreview
              scenario={scenarioWithContext}
              patientContext={patientContext}
              blocked={progress.satisfied < progress.total}
              onGoToChecklist={() => setActiveTab('checklist')}
              selectedCiteIndex={selectedCiteIndex}
              onSelectCiteIndex={onSelectCiteIndex}
              editedNarrative={localState.editedNarrative}
              onSaveNarrative={onSaveNarrative}
            />
          )
        ) : activeTab === 'documents' ? (
          <div className="space-y-6">
            {/* Grounded Chart Q&A */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-slate-200">Grounded Chart Q&amp;A</span>
                <span className="ml-auto text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded px-2 py-0.5">
                  {docs.length} Chart Doc{docs.length !== 1 ? 's' : ''} Indexed
                </span>
              </div>
              <FixtureChat
                variant="compact"
                intro={`Chart context loaded for ${client.patientDisplayName ?? client.name} (${docs.length} source documents). Ask a question or pick a quick prompt below.`}
                suggestions={qaSuggestions}
                deferralReply="Free-form chart Q&A queries run against the live EHR retrieval service (unit O6). Select a grounded prompt above or view documents directly."
                placeholder="Ask about prior trials, lab results, or criteria…"
              />
            </div>

            {/* Indexed documents list (opens in Right Source Chart) */}
            <DocumentsVault
              documents={docs}
              activeDocId={activeDocId}
              onViewDoc={onViewDoc}
            />

            {/* Case Timeline & Activity Log */}
            {scenario.timeline && (
              <div className="pt-2 border-t border-slate-800/60 select-none">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                  Case Timeline
                </p>
                <CaseTimeline events={scenario.timeline} />
              </div>
            )}

            <ActivityLog entries={localState.activity} />
            {localState.activity.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                No coordinator actions logged yet for this session. Exception resolutions and inline packet edits are audited here.
              </p>
            )}
          </div>
        ) : (
          <>
            {scenario.timeline && (
              <div className="pb-3 border-b border-slate-800/60 select-none">
                <CaseTimeline events={scenario.timeline} compact />
              </div>
            )}

            <ActivityLog entries={localState.activity} />

            <div>
              <div className="flex items-center justify-between mb-2 select-none">
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
                <div
                  className="h-full bg-amber-500/30 transition-all duration-500"
                  style={{ width: `${(progress.awaitingDocs / progress.total) * 100}%` }}
                />
              </div>
              <div className="space-y-2">
                {sortedCriteria.map(({ criterion, origIdx }) => (
                  <CriterionRow
                    key={origIdx}
                    index={origIdx + 1}
                    criterion={criterion}
                    localState={localState}
                    actions={actions}
                    isSelected={selectedCiteIndex === origIdx}
                    onSelect={() => onSelectCiteIndex(origIdx)}
                  />
                ))}
              </div>

              {/* Quiet Clinical Grounding Status */}
              <div className="mt-3 flex flex-wrap items-center gap-2 select-none">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  progress.satisfied === progress.total
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {progress.satisfied === progress.total
                    ? 'All Criteria Grounded'
                    : `${progress.satisfied}/${progress.total} Criteria Grounded`}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  !hasUnresolvedRemaining
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                    : 'bg-slate-800/40 text-slate-400 border-slate-700/60'
                }`}>
                  {!hasUnresolvedRemaining ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5 text-amber-400" />}
                  {!hasUnresolvedRemaining ? 'Clinical Safety Verified' : 'Safety Gate Pending Resolution'}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="h-4" />
      </div>

      <CaseActionFooter
        client={client}
        hasUnresolvedRemaining={hasUnresolvedRemaining}
        letterOnScreen={activeTab === 'letter'}
        letterReviewed={letterGen === 'review'}
        onPrint={handlePrint}
        onQuickApprove={() => onQuickApprove(client.scenarioId)}
        onGoToLetter={() => setActiveTab('letter')}
        onOpenCase={() => onOpenCase(client.scenarioId, client.status)}
      />
    </div>
  )
}
