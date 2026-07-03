import { useEffect, useState } from 'react'
import { BookmarkPlus, Building2, Clock, ShieldCheck } from 'lucide-react'
import { type CaseStatus, type Client } from '../../types'
import { TENANT, scenarios } from '../../data/scenarios'
import { InfoHint } from '../ui'
import {
  EMPTY_LOCAL_CASE_STATE,
  type LocalCaseState,
  type StageFilter,
  type UrgencyFilter,
  allExceptionsResolved,
  countActionable,
  filterClients,
  groupByAction,
  statusAfterResolution,
  tourIdFor,
} from './caseQueue'
import { CaseCard } from './CaseCard'
import { CitationPane } from './CitationPane'
import { type CriterionActions } from './CriterionRow'
import { PreviewPane, type PreviewTab } from './PreviewPane'
import { QueueFilterBar } from './QueueFilterBar'

// Three-column case queue: case list · selected-case workspace · citation
// ground truth. Owns per-case local coordinator state (dispatches/overrides);
// durable case status changes go up through the on* callbacks.
export function SplitPortfolioView({
  clients,
  onOpenCase,
  onStartTour,
  onQuickApprove,
  onPayerDecision,
  onUpdateClientStatus,
}: {
  clients: Client[]
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onStartTour: () => void
  onQuickApprove: (scenarioId: string) => void
  onPayerDecision: (scenarioId: string, decision: 'accepted' | 'disputed') => void
  onUpdateClientStatus: (scenarioId: string, status: CaseStatus) => void
}) {
  const [search,        setSearch]        = useState('')
  const [filterStage,   setFilterStage]   = useState<StageFilter>('all')
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all')
  const [showBanner,    setShowBanner]    = useState(true)
  const [selectedId,    setSelectedId]    = useState<number | null>(null)

  const [caseStates,      setCaseStates]      = useState<Record<string, LocalCaseState>>({})
  const [showCitations,   setShowCitations]   = useState(true)
  const [activeCiteIndex, setActiveCiteIndex] = useState<number | null>(null)
  // Tab state lives here so status transitions (e.g. dispute → letter) can drive it
  const [activeTab, setActiveTab] = useState<PreviewTab>('checklist')

  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'
  const actionableCount  = countActionable(clients)
  const submittedCount   = clients.filter(c => c.status === 'submitted').length

  const matches = filterClients(clients, search, filterStage, filterUrgency)
  const groups  = groupByAction(matches)

  // Auto-select: first case on load, and re-select when the current one filters out
  useEffect(() => {
    const firstMatch = groups[0]?.rows[0]
    if (firstMatch && selectedId === null) {
      setSelectedId(firstMatch.id)
      return
    }
    if (selectedId !== null && !matches.find(c => c.id === selectedId)) {
      setSelectedId(groups[0]?.rows[0]?.id ?? null)
    }
  }, [search, filterStage, filterUrgency, clients]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveCiteIndex(null)
  }, [selectedId])

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

  const criterionActions: CriterionActions = {
    stageDispatch:  rule => updateSelectedCaseState(prev => ({ ...prev, pendingDispatch: [...prev.pendingDispatch, rule] })),
    cancelDispatch: rule => updateSelectedCaseState(prev => ({ ...prev, pendingDispatch: prev.pendingDispatch.filter(r => r !== rule) })),
    confirmDispatch: rule => updateSelectedCaseState(prev => ({
      ...prev,
      pendingDispatch: prev.pendingDispatch.filter(r => r !== rule),
      dispatched: [...prev.dispatched, rule],
    })),
    startOverride:  (rule, text) => updateSelectedCaseState(prev => ({ ...prev, pendingOverride: rule, overrideInput: text })),
    cancelOverride: () => updateSelectedCaseState(prev => ({ ...prev, pendingOverride: null, overrideInput: '' })),
    applyOverride:  rule => updateSelectedCaseState(prev => ({
      ...prev,
      pendingOverride: null,
      overrideInput: '',
      overrides: { ...prev.overrides, [rule]: prev.overrideInput },
    })),
    setOverrideInput: txt => updateSelectedCaseState(prev => ({ ...prev, overrideInput: txt })),
  }

  const isClientExceptionsResolved = (client: Client): boolean => {
    const scenario = scenarios[client.scenarioId]
    if (!scenario || client.status !== 'exception') return false
    return allExceptionsResolved(scenario, getLocalCaseState(client.scenarioId))
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
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
          <button
            onClick={() => setShowCitations(!showCitations)}
            className={[
              'px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5',
              showCitations
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600',
            ].join(' ')}
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            {showCitations ? 'Hide Citations' : 'Show Citations'}
          </button>
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

      {/* ── Welcome banner ─────────────────────────────────── */}
      {showBanner && (
        <div className="mx-6 mt-4 mb-0 flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">Clinical Workspace Queue</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              ClearAuth groups prior auths by action type. Resolve clinical exceptions (like PBC contradictions or missing attestations) using the checklist, and click quotes to inspect EHR source texts instantly on the right.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={onStartTour}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              Choose a tour
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-base leading-none px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <QueueFilterBar
        search={search} setSearch={setSearch}
        filterStage={filterStage} setFilterStage={setFilterStage}
        filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
      />

      {/* ── Split body (3 columns) ─────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Col 1: Case list */}
        <div
          id="tour-portfolio-list"
          className="w-[320px] shrink-0 border-r border-slate-800 overflow-y-auto px-3 py-3 bg-slate-950/40"
        >
          {groups.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-sm">
              {search || hasActiveFilters ? 'No cases match the current filters' : 'No cases in the queue'}
            </p>
          ) : (
            groups.map(group => (
              <div key={group.status} className="mb-5">
                <div className="flex items-center gap-2 px-2 py-1 mb-1">
                  <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                  <span className="text-xs text-slate-600 font-mono">{group.rows.length}</span>
                  <InfoHint text={group.hint} wide />
                </div>
                <div className="space-y-1.5">
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

        {/* Col 2: Workspace details & actions */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          <PreviewPane
            client={selectedClient}
            scenario={selectedScenario}
            localState={selectedLocalState}
            actions={criterionActions}
            onOpenCase={onOpenCase}
            onQuickApprove={onQuickApprove}
            onPayerDecision={onPayerDecision}
            selectedCiteIndex={activeCiteIndex}
            onSelectCiteIndex={setActiveCiteIndex}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </div>

        {/* Col 3: Citations ground truth */}
        {showCitations && selectedScenario && (
          <CitationPane
            scenario={selectedScenario}
            highlightedIndex={activeCiteIndex}
            onSelectIndex={setActiveCiteIndex}
          />
        )}
      </div>
    </div>
  )
}
