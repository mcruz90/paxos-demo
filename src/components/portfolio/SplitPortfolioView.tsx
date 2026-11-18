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

// Hybrid Option 2 Clinical Workbench:
// - Queue view: QueueHeader + CaseQueueColumn + empty workspace prompt
// - Open Patient Chart: Full-width 3-column Epic layout (Top Bird's-Eye Queue Ribbon +
//   Left Full-Height Epic Storyboard + Center 3-Tab Workspace + Right Source Chart)
export function SplitPortfolioView({
  clients,
  onOpenCase,
  onQuickApprove,
  onBatchApproveReady,
  onPayerDecision,
  onUpdateClientStatus,
  generateCap,
  live,
  onCaseOpenChange,
  onInspectInBuild,
}: {
  clients: Client[]
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onQuickApprove: (scenarioId: string) => void
  onBatchApproveReady?: () => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onUpdateClientStatus: (scenarioId: string, status: CaseStatus) => void
  generateCap: UnitCapability
  live?: LiveShellSession
  onCaseOpenChange?: (open: boolean) => void
  onInspectInBuild?: (scenarioId: string) => void
}) {
  const [search,        setSearch]        = useState('')
  const [filterStage,   setFilterStage]   = useState<StageFilter>('all')
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all')
  // Default to Diane Okafor (id: 3, Case #PH-2847) so the 3-column Epic clinical
  // layout opens directly into a rich clinical workspace rather than an empty prompt.
  const [selectedId,    setSelectedId]    = useState<number | null>(3)

  const [caseStates,      setCaseStates]      = useState<Record<string, LocalCaseState>>({})
  const [showCitations,   setShowCitations]   = useState(true)
  const [activeCiteIndex, setActiveCiteIndex] = useState<number | null>(null)
  const [citeView,        setCiteView]        = useState<'source' | 'citations'>('source')
  const [activeDocId,     setActiveDocId]     = useState<string | null>(null)
  const [resolver, setResolver] = useState<
    { mode: 'criterion'; criterion: CriterionResult } | { mode: 'dispute' } | null
  >(null)
  const [activeTab, setActiveTab] = useState<PreviewTab>('checklist')

  const matches = filterClients(clients, search, filterStage, filterUrgency)
  const groups  = groupByAction(matches)

  useEffect(() => {
    if (selectedId !== null && !matches.find(c => c.id === selectedId)) {
      setSelectedId(groups[0]?.rows[0]?.id ?? null)
    }
  }, [search, filterStage, filterUrgency, clients]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveCiteIndex(null)
    setActiveTab('checklist')
    setCiteView('source')
    setActiveDocId(null)
    setResolver(null)
    onCaseOpenChange?.(selectedId !== null)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSaveNarrative = (text: string) => {
    updateSelectedCaseState(prev => logActivity(
      { ...prev, editedNarrative: text },
      { at: now(), action: 'Packet edited inline', detail: 'Clinician narrative edited · provenance: human_edited' },
    ))
  }

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
        updateSelectedCaseState(prev => dispatchWithLog(prev, label))
      } else {
        updateSelectedCaseState(prev => logActivity(
          { ...prev, overrides: { ...prev.overrides, [label]: justification } },
          { at: now(), action: 'Exception resolved', detail: `${label} — evidence-backed justification`,
            artifact: { title: 'Recorded justification', body: justification } },
        ))
      }
    } else {
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

  const previewPaneEl = (
    <PreviewPane
      client={selectedClient}
      scenario={selectedScenario}
      localState={selectedLocalState}
      actions={criterionActions}
      onOpenCase={onOpenCase}
      onQuickApprove={onQuickApprove}
      onPayerDecision={onPayerDecision}
      onSaveNarrative={handleSaveNarrative}
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
      {!selectedClient && <QueueHeader clients={clients} />}

      <div className="flex-1 flex overflow-hidden min-h-0">
        {!selectedClient && (
          <CaseQueueColumn
            clients={clients}
            groups={groups}
            search={search} setSearch={setSearch}
            filterStage={filterStage} setFilterStage={setFilterStage}
            filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hasOpenCase={false}
            showCaseList={true}
            onToggleCaseList={() => {}}
            isClientExceptionsResolved={isClientExceptionsResolved}
          />
        )}

        {selectedClient && selectedScenario ? (
          <PatientProfile
            patient={patientForClient(clients, selectedClient)}
            scenario={selectedScenario}
            activeScenarioId={selectedClient.scenarioId}
            clients={clients}
            onSelectClient={setSelectedId}
            onSelectCase={sid => { const c = clients.find(x => x.scenarioId === sid); if (c) setSelectedId(c.id) }}
            onBackToQueue={() => setSelectedId(null)}
            onBatchApproveReady={onBatchApproveReady}
            onInspectInBuild={onInspectInBuild}
            workspace={<>
              <div className="flex-1 flex overflow-hidden min-w-0">{previewPaneEl}</div>
              {col3El}
            </>}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden min-w-0">{previewPaneEl}</div>
        )}
      </div>

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
