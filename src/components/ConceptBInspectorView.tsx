import { useEffect, useMemo, useState } from 'react'
import { BarChart2, Play, Terminal } from 'lucide-react'
import { type CapabilityManifest } from '../capabilities'
import { resolvePatientContext } from '../data/patientContext'
import { initialClients, scenarios } from '../data/scenarios'
import type { PendingReviewItem } from '../lib/wire'
import { EvalDashboard } from './EvalDashboard'
import { InspectorAuditColumn } from './inspector/InspectorAuditColumn'
import { InspectorGateColumn } from './inspector/InspectorGateColumn'
import { CapabilityChip } from './live/CapabilityChip'
import { type LiveShellSession } from './live/SessionGate'
import { shouldRefreshQueue } from './poc/live/queue'
import { useAuditTrail } from './poc/live/useAuditTrail'
import { useLiveAppeal } from './poc/live/useLiveAppeal'
import { usePendingQueue } from './poc/live/usePendingQueue'
import { phiFromContext } from './portfolio/redaction'
import { SourceDocViewer } from './portfolio/SourceDocViewer'
import { RoleChip } from './ui'

function InspectorHeader({
  selectedScenarioId,
  onSelectScenarioId,
  live,
  streaming,
  onRun,
  subTab,
  onSetSubTab,
}: {
  selectedScenarioId: string
  onSelectScenarioId: (id: string) => void
  live?: LiveShellSession
  streaming: boolean
  onRun: () => void
  subTab: 'trace' | 'quality'
  onSetSubTab: (tab: 'trace' | 'quality') => void
}) {
  return (
    <div className="px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-900/40">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Terminal className="w-5 h-5 text-violet-400 shrink-0" />
          <h1 className="text-lg font-bold font-display text-white">Technical Clinician &amp; Evals Harness Inspector</h1>
          <RoleChip layer="build" />
          <CapabilityChip cap={live ? 'live' : 'simulated'} />
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          PHI-free control plane: PII tokenization, eval harness (clearauth-eval) checks, and interactive gate-to-span tracing.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          aria-label="Inspect scenario"
          value={selectedScenarioId}
          onChange={e => onSelectScenarioId(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
        >
          {initialClients.map(c => (
            <option key={c.scenarioId} value={c.scenarioId}>{c.name} · {c.drug} ({c.payer})</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRun}
          disabled={!live || streaming}
          title={live ? 'Run live SSE appeal stream' : 'Requires connected backend session (VITE_API_BASE_URL)'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-45 disabled:cursor-not-allowed text-white transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {streaming ? 'Streaming Trace…' : live ? 'Run Live Evals Stream' : 'Live Stream (Demo Only)'}
        </button>
        <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700/70 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onSetSubTab('trace')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${subTab === 'trace' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            3-Column Case Trace
          </button>
          <button
            type="button"
            onClick={() => onSetSubTab('quality')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${subTab === 'quality' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Pipeline Quality Report
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConceptBInspectorView({
  selectedScenarioId,
  onSelectScenarioId,
  live,
  manifest,
}: {
  selectedScenarioId: string
  onSelectScenarioId: (scenarioId: string) => void
  live?: LiveShellSession
  manifest: CapabilityManifest
}) {
  const [subTab, setSubTab] = useState<'trace' | 'quality'>('trace')
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [activeCiteIndex, setActiveCiteIndex] = useState<number | null>(null)
  const [resumeTarget, setResumeTarget] = useState<PendingReviewItem | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)

  const scenario = scenarios[selectedScenarioId] ?? scenarios['gilead-livdelzi']
  const client = useMemo(() => initialClients.find(c => c.scenarioId === scenario.id) ?? initialClients[0], [scenario.id])
  const phi = useMemo(() => phiFromContext(resolvePatientContext(scenario, client)), [scenario, client])

  useEffect(() => {
    setActiveDocId(null)
    const firstIssue = scenario.criteriaResults.findIndex(cr => cr.status !== 'found')
    setActiveCiteIndex(firstIssue >= 0 ? firstIssue : 0)
  }, [scenario.id, scenario.criteriaResults])

  const noop = () => {}
  const queue = usePendingQueue(!!live && manifest.O7_pending_queue === 'live', live?.onExpire ?? noop)
  const audit = useAuditTrail(!!live && manifest.B8_audit_trail === 'live', live?.onExpire ?? noop)
  const appeal = useLiveAppeal(live?.csrfToken ?? '', live?.onExpire ?? noop)

  const handleRunEvalStream = async () => {
    if (!live) return
    await appeal.run(scenario)
    await Promise.all([queue.refresh(), audit.refresh()])
  }

  const handleResume = async (editedText: string | null) => {
    if (!resumeTarget || !live) return
    setResumeBusy(true)
    try {
      const result = await appeal.resume(resumeTarget.correlation_id, editedText, live.csrfToken)
      if (!shouldRefreshQueue(result)) return
      queue.drop(resumeTarget.correlation_id)
      await Promise.all([queue.refresh(), audit.refresh()])
      setResumeTarget(null)
    } finally {
      setResumeBusy(false)
    }
  }

  const unresolvedCount = scenario.criteriaResults.filter(cr => cr.status !== 'found').length

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      <InspectorHeader
        selectedScenarioId={scenario.id}
        onSelectScenarioId={onSelectScenarioId}
        live={live}
        streaming={appeal.state.status === 'streaming'}
        onRun={handleRunEvalStream}
        subTab={subTab}
        onSetSubTab={setSubTab}
      />
      {subTab === 'quality' ? (
        <EvalDashboard mode="platform_only" />
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          <div className="lg:col-span-4 border-r border-slate-800 flex flex-col overflow-hidden min-h-0">
            <SourceDocViewer scenario={scenario} activeCiteIndex={activeCiteIndex} activeDocId={activeDocId} onSelectDoc={setActiveDocId} phi={phi} forcePlane="build" />
          </div>
          <InspectorGateColumn
            scenario={scenario}
            done={appeal.state.done}
            steps={appeal.state.steps}
            streaming={appeal.state.status === 'streaming'}
            activeCiteIndex={activeCiteIndex}
            onSelectCiteIndex={setActiveCiteIndex}
          />
          <InspectorAuditColumn
            client={client}
            unresolvedCount={unresolvedCount}
            live={live}
            manifest={manifest}
            queue={queue}
            audit={audit}
            draftLetter={appeal.state.letter || ''}
            resumeTarget={resumeTarget}
            onSelectResume={setResumeTarget}
            resumeBusy={resumeBusy}
            resumeError={appeal.state.status === 'error' ? appeal.state.error : null}
            onResume={handleResume}
          />
        </div>
      )}
    </div>
  )
}
