import { useEffect, useState } from 'react'
import { type CaseStatus, type Client, type CriterionResult } from '../../types'
import { scenarios } from '../../data/scenarios'
import {
  EMPTY_LOCAL_CASE_STATE,
  type LocalCaseState,
  type StageFilter,
  type UrgencyFilter,
  allExceptionsResolved,
  buildDispatchArtifact,
  filterClients,
  groupByAction,
  logActivity,
  statusAfterResolution,
} from './caseQueue'
import { CaseQueueColumn } from './CaseQueueColumn'
import { QueueHeader } from './QueueHeader'
import { EvidencePane } from './EvidencePane'
import { type CriterionActions } from './CriterionRow'
import { ExceptionResolverModal } from './ExceptionResolverModal'
import { buildCriterionResolverContext, buildDisputeResolverContext } from './exceptionResolver'
import { patientForClient } from './patient'
import { PatientProfile } from './PatientProfile'
import { PreviewPane, type PreviewTab } from './PreviewPane'
import { phiFromContext } from './redaction'
import { resolvePatientContext } from '../../data/patientContext'
import { type UnitCapability } from '../../capabilities'
import { type LiveShellSession } from '../live/SessionGate'

// Three-column case queue: case list · selected-case workspace · citation
// ground truth. Owns per-case local coordinator state (dispatches/overrides);
// durable case status changes go up through the on* callbacks.
export function SplitPortfolioView({
  clients,
  onOpenCase,
  onQuickApprove,
  onPayerDecision,
  onUpdateClientStatus,
  generateCap,
  live,
}: {
  clients: Client[]
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onUpdateClientStatus: (scenarioId: string, status: CaseStatus) => void
  // Manifest capability + backend session for O4_generate, threaded to
  // PreviewPane (ADR-0016 — only the shell reads the manifest). Both are
  // shell-supplied; `live` is undefined in demo mode.
  generateCap: UnitCapability
  live?: LiveShellSession
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
      generateCap={generateCap}
      live={live}
    />
  )

  const col3El = selectedScenario ? (
    <EvidencePane
      scenario={selectedScenario}
      phi={selectedClient ? phiFromContext(resolvePatientContext(selectedScenario, selectedClient)) : null}
      showCitations={showCitations}
      onToggleCitations={() => setShowCitations(v => !v)}
      citeView={citeView}
      setCiteView={setCiteView}
      activeCiteIndex={activeCiteIndex}
      onSelectCiteIndex={setActiveCiteIndex}
      activeDocId={activeDocId}
      onSelectDoc={setActiveDocId}
    />
  ) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Triage chrome — hidden while a case is open (focus mode); the
          workspace header carries the case identity instead. */}
      {!selectedClient && <QueueHeader clients={clients} />}

      {/* ── Split body (3 columns) ─────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        <CaseQueueColumn
          clients={clients}
          groups={groups}
          search={search} setSearch={setSearch}
          filterStage={filterStage} setFilterStage={setFilterStage}
          filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
          selectedId={selectedId}
          onSelect={setSelectedId}
          hasOpenCase={!!selectedClient}
          showCaseList={showCaseList}
          onToggleCaseList={() => setShowCaseList(v => !v)}
          isClientExceptionsResolved={isClientExceptionsResolved}
        />

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
