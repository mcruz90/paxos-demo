import { useEffect, useState } from 'react'
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { type CaseStatus, type Client, type CriterionResult } from '../../types'
import { TENANT, scenarios } from '../../data/scenarios'
import { InfoHint } from '../ui'
import {
  EMPTY_LOCAL_CASE_STATE,
  type LocalCaseState,
  type StageFilter,
  type UrgencyFilter,
  allExceptionsResolved,
  buildDispatchArtifact,
  countActionable,
  filterClients,
  groupByAction,
  logActivity,
  statusAfterResolution,
  tourIdFor,
} from './caseQueue'
import { CaseCard } from './CaseCard'
import { CitationPane } from './CitationPane'
import { type CriterionActions } from './CriterionRow'
import { ExceptionResolverModal } from './ExceptionResolverModal'
import { buildCriterionResolverContext, buildDisputeResolverContext } from './exceptionResolver'
import { patientForClient } from './patient'
import { PatientProfile } from './PatientProfile'
import { PreviewPane, type PreviewTab } from './PreviewPane'
import { QueueFilterBar } from './QueueFilterBar'
import { phiFromContext } from './redaction'
import { resolvePatientContext } from '../../data/patientContext'
import { SourceDocViewer } from './SourceDocViewer'

// Three-column case queue: case list · selected-case workspace · citation
// ground truth. Owns per-case local coordinator state (dispatches/overrides);
// durable case status changes go up through the on* callbacks.
export function SplitPortfolioView({
  clients,
  onOpenCase,
  onQuickApprove,
  onPayerDecision,
  onUpdateClientStatus,
}: {
  clients: Client[]
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onUpdateClientStatus: (scenarioId: string, status: CaseStatus) => void
}) {
  const [search,        setSearch]        = useState('')
  const [filterStage,   setFilterStage]   = useState<StageFilter>('all')
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all')
  const [selectedId,    setSelectedId]    = useState<number | null>(null)

  const [caseStates,      setCaseStates]      = useState<Record<string, LocalCaseState>>({})
  const [showCitations,   setShowCitations]   = useState(true)
  const [activeCiteIndex, setActiveCiteIndex] = useState<number | null>(null)
  // Right pane can show the rendered source documents or the citation snippet
  // cards; cases that authored sourceDocuments default to the document view.
  const [citeView,        setCiteView]        = useState<'source' | 'citations'>('source')
  // Which source document the right-pane viewer shows (null ⇒ first). Lifted so
  // the Documents vault (middle pane) and a criterion click both drive it.
  const [activeDocId,     setActiveDocId]     = useState<string | null>(null)
  // The case list collapses once a case is open so the operator can focus on it.
  const [showCaseList,    setShowCaseList]    = useState(true)
  // Exception Resolver modal: resolving a needs_review criterion, or assembling
  // the round-2 evidence packet for a payer counter-offer dispute.
  const [resolver, setResolver] = useState<
    { mode: 'criterion'; criterion: CriterionResult } | { mode: 'dispute' } | null
  >(null)
  // Tab state lives here so status transitions (e.g. dispute → letter) can drive it
  const [activeTab, setActiveTab] = useState<PreviewTab>('checklist')

  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'
  const actionableCount  = countActionable(clients)
  const submittedCount   = clients.filter(c => c.status === 'submitted').length
  const dueTodayCount    = clients.filter(c => c.urgency === 'today').length

  const matches = filterClients(clients, search, filterStage, filterUrgency)
  const groups  = groupByAction(matches)

  // No auto-select on load — the queue opens blank so the first thing a user
  // sees isn't an arbitrary case. Once a case is selected, re-select the next
  // best match if the current one filters out from under them.
  useEffect(() => {
    if (selectedId !== null && !matches.find(c => c.id === selectedId)) {
      setSelectedId(groups[0]?.rows[0]?.id ?? null)
    }
  }, [search, filterStage, filterUrgency, clients]) // eslint-disable-line react-hooks/exhaustive-deps

  // Switching cases resets the per-case view: clear the citation highlight and
  // return to the default Checklist tab, so a case never opens on the tab left
  // over from the previous one. A dispute drives checklist→letter within the
  // same selected case (selectedId unchanged), so this reset doesn't fight it.
  useEffect(() => {
    setActiveCiteIndex(null)
    setActiveTab('checklist')
    setCiteView('source')
    setActiveDocId(null)
    setResolver(null)
    // Focus the workspace on open; restore the queue when deselected.
    setShowCaseList(selectedId === null)
  }, [selectedId])

  // Middle-pane vault → right-pane viewer: show the picked document, ensure the
  // source view is the visible right-pane mode, and reveal the pane if hidden.
  const viewDoc = (docId: string) => {
    setActiveDocId(docId)
    setCiteView('source')
    setShowCitations(true)
  }

  const getLocalCaseState = (scenarioId: string): LocalCaseState =>
    caseStates[scenarioId] ?? EMPTY_LOCAL_CASE_STATE

  const selectedClient     = matches.find(c => c.id === selectedId) ?? null
  const selectedScenario   = selectedClient ? (scenarios[selectedClient.scenarioId] ?? null) : null
  const selectedLocalState = selectedClient ? getLocalCaseState(selectedClient.scenarioId) : EMPTY_LOCAL_CASE_STATE

  // Applies a local-state update for the selected case; once every exception is
  // resolved, moves the case to its next durable status after a short beat.
  const updateSelectedCaseState = (updater: (prev: LocalCaseState) => LocalCaseState) => {
    if (!selectedClient || !selectedScenario) return
    const next = updater(getLocalCaseState(selectedClient.scenarioId))
    setCaseStates(prev => ({ ...prev, [selectedClient.scenarioId]: next }))
    if (allExceptionsResolved(selectedScenario, next)) {
      setTimeout(() => {
        onUpdateClientStatus(selectedClient.scenarioId, statusAfterResolution(next))
      }, 400)
    }
  }

  const now = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  // Dispatch + a logged snapshot of the outbound request (auditability: the
  // log holds a copy of what was sent, not just that something was sent).
  const dispatchWithLog = (prev: LocalCaseState, rule: string): LocalCaseState => {
    const criterion = selectedScenario?.criteriaResults.find(c => c.rule.label === rule)
    const next: LocalCaseState = {
      ...prev,
      pendingDispatch: prev.pendingDispatch.filter(r => r !== rule),
      dispatched: [...prev.dispatched, rule],
    }
    if (!criterion || !selectedScenario) return next
    return logActivity(next, {
      at: now(),
      action: 'Workflow dispatched',
      detail: `${criterion.workflowPlan?.channel ?? 'outbound'} → ${criterion.workflowPlan?.recipient ?? 'provider'} · ${rule}`,
      artifact: buildDispatchArtifact(selectedScenario, criterion),
    })
  }

  const criterionActions: CriterionActions = {
    stageDispatch:  rule => updateSelectedCaseState(prev => ({ ...prev, pendingDispatch: [...prev.pendingDispatch, rule] })),
    cancelDispatch: rule => updateSelectedCaseState(prev => ({ ...prev, pendingDispatch: prev.pendingDispatch.filter(r => r !== rule) })),
    confirmDispatch: rule => updateSelectedCaseState(prev => dispatchWithLog(prev, rule)),
    startOverride:  (rule, text) => updateSelectedCaseState(prev => ({ ...prev, pendingOverride: rule, overrideInput: text })),
    cancelOverride: () => updateSelectedCaseState(prev => ({ ...prev, pendingOverride: null, overrideInput: '' })),
    applyOverride:  rule => updateSelectedCaseState(prev => logActivity({
      ...prev,
      pendingOverride: null,
      overrideInput: '',
      overrides: { ...prev.overrides, [rule]: prev.overrideInput },
    }, { at: now(), action: 'Finding overridden', detail: `${rule} — "${prev.overrideInput}"` })),
    setOverrideInput: txt => updateSelectedCaseState(prev => ({ ...prev, overrideInput: txt })),
    openResolver: criterion => setResolver({ mode: 'criterion', criterion }),
  }

  // Resolver context for the open modal (null when closed or no case selected).
  const resolverCtx = resolver && selectedScenario
    ? resolver.mode === 'criterion'
      ? buildCriterionResolverContext(selectedScenario, resolver.criterion)
      : buildDisputeResolverContext(selectedScenario)
    : null

  const applyResolver = (justification: string, path: 'workflow' | 'justify') => {
    if (!resolver || !selectedClient) return
    if (resolver.mode === 'criterion') {
      const label = resolver.criterion.rule.label
      if (path === 'workflow') {
        // Dispatch the outbound workflow — same local-state path as the inline
        // confirm; statusAfterResolution parks the case awaiting documentation.
        updateSelectedCaseState(prev => dispatchWithLog(prev, label))
      } else {
        // Evidence-backed resolution records as an override with the assembled
        // justification — same local-state path as the inline override.
        updateSelectedCaseState(prev => logActivity(
          { ...prev, overrides: { ...prev.overrides, [label]: justification } },
          { at: now(), action: 'Exception resolved', detail: `${label} — evidence-backed justification`,
            artifact: { title: 'Recorded justification', body: justification } },
        ))
      }
    } else {
      // Dispute with the packet assembled: log it, then proceed to the letter.
      updateSelectedCaseState(prev => logActivity(prev, {
        at: now(), action: 'Counter-offer disputed', detail: 'Round-2 evidence packet assembled',
        artifact: { title: 'Dispute evidence packet', body: justification },
      }))
      onPayerDecision(selectedClient.scenarioId, 'disputed')
      setActiveTab('letter')
    }
    setResolver(null)
  }

  const isClientExceptionsResolved = (client: Client): boolean => {
    const scenario = scenarios[client.scenarioId]
    if (!scenario || client.status !== 'exception') return false
    return allExceptionsResolved(scenario, getLocalCaseState(client.scenarioId))
  }

  // The case workspace (middle pane) + the source-doc/citations pane — built
  // once here and slotted into the patient profile's Prior Auth Hub (or shown
  // directly as the empty prompt when no case is selected).
  const previewPaneEl = (
    <PreviewPane
      client={selectedClient}
      scenario={selectedScenario}
      localState={selectedLocalState}
      actions={criterionActions}
      onOpenCase={onOpenCase}
      onQuickApprove={onQuickApprove}
      onPayerDecision={onPayerDecision}
      onBackToQueue={() => setSelectedId(null)}
      selectedCiteIndex={activeCiteIndex}
      onSelectCiteIndex={setActiveCiteIndex}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      activeDocId={activeDocId}
      onViewDoc={viewDoc}
      onOpenDisputeResolver={
        selectedScenario?.round2Appeal ? () => setResolver({ mode: 'dispute' }) : undefined
      }
    />
  )

  const col3El = selectedScenario ? (
    <div className="flex shrink-0 overflow-hidden">
      <button
        onClick={() => setShowCitations(!showCitations)}
        title={showCitations ? 'Hide citations' : 'Show citations'}
        className="w-6 shrink-0 border-l border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
      >
        {showCitations ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
          Citations
        </span>
      </button>
      <div className={`border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${showCitations ? 'w-[640px]' : 'w-0'}`}>
        {selectedScenario.sourceDocuments?.length ? (
          <div className="flex gap-1 p-2 border-b border-slate-800 shrink-0">
            {([
              { view: 'source' as const,    label: 'Source Doc' },
              { view: 'citations' as const, label: 'Citations'  },
            ]).map(({ view, label }) => (
              <button
                key={view}
                onClick={() => setCiteView(view)}
                className={[
                  'flex-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border',
                  citeView === view
                    ? 'bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex-1 min-h-0 w-[640px]">
          {selectedScenario.sourceDocuments?.length && citeView === 'source' ? (
            <SourceDocViewer
              scenario={selectedScenario}
              activeCiteIndex={activeCiteIndex}
              activeDocId={activeDocId}
              onSelectDoc={setActiveDocId}
              phi={selectedClient ? phiFromContext(resolvePatientContext(selectedScenario, selectedClient)) : null}
            />
          ) : (
            <CitationPane
              scenario={selectedScenario}
              highlightedIndex={activeCiteIndex}
              onSelectIndex={setActiveCiteIndex}
            />
          )}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header — triage chrome, hidden while a case is open (focus mode);
          the workspace header carries the case identity instead. ─────────── */}
      {!selectedClient && (
      <>
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold font-display text-white">Case Queue</h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700"
              title={`Operating as ${TENANT.name} — ${TENANT.type}. Cases sourced from ${TENANT.source}.`}
            >
              <Building2 className="w-3 h-3 text-slate-400" />
              <span className="text-slate-200 font-medium">{TENANT.name}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400">{TENANT.source}</span>
            </span>
          </div>
          <p className="text-sm mt-0.5 flex items-center gap-2">
            {actionableCount > 0
              ? <span className="text-white font-medium">{actionableCount} case{actionableCount !== 1 ? 's' : ''} need your action</span>
              : <span className="text-slate-400">All cases up to date</span>}
            {submittedCount > 0 && (
              <><span className="text-slate-700">·</span>
              <span className="text-slate-500 text-xs">{submittedCount} awaiting payer</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40"
            title="Cases import automatically from Epic via FHIR Subscriptions the moment the record updates."
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-slate-300">Auto-synced from Epic · live</span>
          </div>
        </div>
      </div>

      </>
      )}

      {/* ── Split body (3 columns) ─────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Col 1: Case list — collapses once a case is open (focus mode). The
            persistent handle to its right slides it back in. */}
        <div className="flex shrink-0 overflow-hidden">
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showCaseList ? 'w-[430px]' : 'w-0'}`}>
            <div
              id="tour-portfolio-list"
              className="w-[430px] h-full border-r border-slate-800 overflow-y-auto p-4 bg-slate-950/40"
            >
          {/* Search + filters govern the roster, so they live inside it */}
          <QueueFilterBar
            search={search} setSearch={setSearch}
            filterStage={filterStage} setFilterStage={setFilterStage}
            filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
          />

          {/* Roster stat strip — all counts derived from the live client list.
              Deliberately NO fabricated "approval %": that needs a real audit
              aggregate (/api/audit/records), which the demo doesn't have yet. */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {([
              { label: 'Total roster', value: clients.length,   tone: 'text-slate-100' },
              { label: 'Needs action', value: actionableCount,  tone: actionableCount > 0 ? 'text-amber-300' : 'text-slate-100' },
              { label: 'Due today',    value: dueTodayCount,     tone: dueTodayCount > 0 ? 'text-red-300' : 'text-slate-100' },
            ]).map(({ label, value, tone }) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-center">
                <p className={`text-lg font-bold font-display leading-none ${tone}`}>{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1.5">{label}</p>
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-sm">
              {search || hasActiveFilters ? 'No cases match the current filters' : 'No cases in the queue'}
            </p>
          ) : (
            groups.map(group => (
              <div key={group.status} className="mb-6">
                <div className="flex items-center gap-2 px-2 py-1 mb-2">
                  <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                  <span className="text-xs text-slate-600 font-mono">{group.rows.length}</span>
                  <InfoHint text={group.hint} wide />
                </div>
                <div className="space-y-2.5">
                  {group.rows.map(client => (
                    <CaseCard
                      key={client.id}
                      client={client}
                      selected={selectedId === client.id}
                      onClick={() => setSelectedId(client.id)}
                      tourId={tourIdFor(client)}
                      isResolved={isClientExceptionsResolved(client)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
            </div>
          </div>
          {/* Reopen handle — shown only while a case is open, so there is
              something to focus on by hiding the queue. */}
          {selectedClient && (
            <button
              onClick={() => setShowCaseList(v => !v)}
              title={showCaseList ? 'Hide queue' : 'Show queue'}
              className="w-6 shrink-0 border-r border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
            >
              {showCaseList ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
                Queue
              </span>
            </button>
          )}
        </div>

        {/* Workspace region: when a case is open it lives inside the patient
            profile's Prior Auth Hub; otherwise the empty prompt shows. */}
        {selectedClient && selectedScenario ? (
          <PatientProfile
            patient={patientForClient(clients, selectedClient)}
            scenario={selectedScenario}
            activeScenarioId={selectedClient.scenarioId}
            onSelectCase={sid => { const c = clients.find(x => x.scenarioId === sid); if (c) setSelectedId(c.id) }}
            onBackToQueue={() => setSelectedId(null)}
            workspace={<>
              <div className="flex-1 flex overflow-hidden min-w-0">{previewPaneEl}</div>
              {col3El}
            </>}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden min-w-0">{previewPaneEl}</div>
        )}
      </div>

      {/* Exception Resolver — evidence packet assembly (criterion override or
          payer-counter-offer dispute). */}
      {resolverCtx && (
        <ExceptionResolverModal
          ctx={resolverCtx}
          applyLabel={resolver?.mode === 'dispute' ? 'Attach Evidence & Dispute' : 'Apply Resolution'}
          onApply={applyResolver}
          onClose={() => setResolver(null)}
        />
      )}
    </div>
  )
}
