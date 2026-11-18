import { useState } from 'react'
import { CheckCircle, ChevronRight, Info } from 'lucide-react'
import { type View } from '../types'
import { FailureClusterDetail } from './FailureClusterDetail'
import { FAILURE_CLUSTERS, type FailureCluster, SEVERITY_CLS, SEVERITY_RANK } from './failureReviewData'
import { type InstructionStore, NODE_META } from './instructions'
import { IllustrativeTag, RoleChip } from './ui'

export {
  FAILURE_CLUSTERS, FIX_GATEKEEPER_SAFETY, FIX_RETRIEVAL_CONFLICT, FIX_RETRIEVAL_GROUNDING,
  FIX_SYNTHESIS_OVERCAUTION, SEVERITY_CLS, SEVERITY_RANK, type FailureCluster,
} from './failureReviewData'

const TREND_GLYPH: Record<string, string> = { up: '↑', flat: '→', down: '↓' }
const TREND_CLS: Record<string, string> = { up: 'text-red-400', flat: 'text-slate-500', down: 'text-emerald-400' }

function PipelineHealthBar({ nodeFilter, setNodeFilter }: { nodeFilter: string | null; setNodeFilter: (id: string | null) => void }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-semibold text-white">Pipeline health</h2>
        <span className="text-xs text-slate-500">— where in the pipeline failures land; select a node to filter the worklist</span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {NODE_META.map((n, i) => {
          const Icon = n.icon
          const nodeClusters = FAILURE_CLUSTERS.filter(c => c.node === n.id)
          const total = nodeClusters.reduce((s, c) => s + c.count, 0)
          const worst = nodeClusters.reduce<FailureCluster['severity'] | null>((w, c) => (w === null || SEVERITY_RANK[c.severity] < SEVERITY_RANK[w] ? c.severity : w), null)
          const healthy = nodeClusters.length === 0
          const active = nodeFilter === n.id
          return (
            <div key={n.id} className="contents">
              <button
                onClick={() => { if (!healthy) setNodeFilter(active ? null : n.id) }} disabled={healthy}
                className={`flex-1 text-left flex flex-col p-3 rounded-xl border transition-all ${
                  active ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : healthy ? 'bg-slate-800/40 border-slate-700/50 cursor-default'
                  : 'bg-slate-800/50 border-slate-700/60 hover:border-emerald-500/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${healthy ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700/50 text-slate-300'}`}><Icon className="w-4 h-4" /></div>
                  <span className="text-sm font-semibold text-white">{n.node}</span>
                </div>
                {healthy ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400"><CheckCircle className="w-3.5 h-3.5 shrink-0" />No failures</div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${SEVERITY_CLS[worst!]}`}>{worst}</span>
                    <span className="text-[11px] text-slate-500">{nodeClusters.length} cluster{nodeClusters.length > 1 ? 's' : ''} · {total} failures</span>
                  </div>
                )}
              </button>
              {i < NODE_META.length - 1 && (
                <div className="flex lg:flex-col items-center justify-center shrink-0 lg:w-6 py-1 lg:py-0 text-slate-600"><ChevronRight className="w-4 h-4 rotate-90 lg:rotate-0" /></div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FailureClusterList({
  ordered, nodeFilter, resolved, onClearFilter, onSelectCluster,
}: {
  ordered: FailureCluster[]; nodeFilter: string | null; resolved: Record<string, number>
  onClearFilter: () => void; onSelectCluster: (id: string) => void
}) {
  const rows = nodeFilter ? ordered.filter(c => c.node === nodeFilter) : ordered
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-2">
            {nodeFilter ? <>Failures at <span className="font-mono text-slate-300">{NODE_META.find(n => n.id === nodeFilter)?.node}</span></> : 'Failure Clusters'}
            {nodeFilter && <button onClick={onClearFilter} className="text-xs font-normal text-emerald-400 hover:underline">clear</button>}
          </h2>
          <p className="text-xs text-slate-500">Prioritized by severity × volume — 3 safety failures outrank 50 over-cautious ones</p>
        </div>
        <span className="text-xs text-slate-500">Last sampled from prod · Jun 15, 2026</span>
      </div>
      <div className="space-y-2">
        {rows.map(c => {
          const isResolved = !!resolved[c.id]
          const node = NODE_META.find(n => n.id === c.node)!
          return (
            <button key={c.id} onClick={() => onSelectCluster(c.id)} className="w-full flex items-center gap-4 px-4 py-3.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-left hover:border-slate-600 transition-colors">
              <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 w-16 text-center ${SEVERITY_CLS[c.severity]}`}>{c.severity}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{c.mode} <span className="text-slate-600 font-normal">· {c.failureClass}</span></p>
                <p className="text-xs text-slate-500 mt-0.5">implicates <span className="font-mono text-slate-400">{node.node}</span> instruction</p>
              </div>
              <div className="flex items-baseline gap-1 shrink-0">
                <span className="text-lg font-bold font-mono text-slate-200">{c.count}</span>
                <span className={`text-sm ${TREND_CLS[c.trend]}`}>{TREND_GLYPH[c.trend]}</span>
              </div>
              {isResolved
                ? <span className="text-[10px] px-2 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shrink-0">resolved</span>
                : <span className="text-[10px] px-2 py-0.5 rounded-full border text-slate-400 bg-slate-700/40 border-slate-600/30 shrink-0">open</span>}
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FailureReviewView({
  setView, store, onInspectScenario,
}: {
  setView: (v: View) => void; store: InstructionStore; onInspectScenario?: (scenarioId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Record<string, number>>({})
  const [nodeFilter, setNodeFilter] = useState<string | null>(null)
  const ordered = [...FAILURE_CLUSTERS].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count)
  const selected = FAILURE_CLUSTERS.find(c => c.id === selectedId) ?? null
  const totalFailures = FAILURE_CLUSTERS.reduce((n, c) => n + c.count, 0)
  const openClusters = FAILURE_CLUSTERS.filter(c => !resolved[c.id]).length

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">{selected ? 'Failure Cluster' : 'Prod Health'}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {selected ? 'Investigate the failure mode, then remediate it once — for the whole cluster' : 'Failures sampled from production, grouped by mode and prioritized — remediate at the cluster level'}
          </p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>
      <div className="px-8 py-6 space-y-8">
        {!selected ? (
          <>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Failure Rate (7d)', value: '2.1%', sub: 'of processed cases' },
                { label: 'Failures (7d)', value: `${totalFailures}`, sub: 'across the suite' },
                { label: 'Failure Modes', value: `${FAILURE_CLUSTERS.length}`, sub: 'distinct clusters' },
                { label: 'Open Clusters', value: `${openClusters}`, sub: 'awaiting remediation' },
              ].map(m => (
                <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
                  <p className="text-2xl font-bold font-mono text-slate-100 leading-none">{m.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{m.sub}</p>
                </div>
              ))}
            </div>
            <PipelineHealthBar nodeFilter={nodeFilter} setNodeFilter={setNodeFilter} />
            <FailureClusterList ordered={ordered} nodeFilter={nodeFilter} resolved={resolved} onClearFilter={() => setNodeFilter(null)} onSelectCluster={setSelectedId} />
            <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-400 leading-relaxed">
                Failures are sampled from production runs and QA review. You fix the <span className="text-slate-300 font-medium">cluster</span>, not the case — validated in sandbox before canary rollout.
              </p>
            </div>
          </>
        ) : (
          <FailureClusterDetail
            selected={selected} node={NODE_META.find(n => n.id === selected.node)!} resolvedVersion={resolved[selected.id]}
            store={store} setView={setView} onBack={() => setSelectedId(null)}
            onResolved={v => setResolved(r => ({ ...r, [selected.id]: v }))} onInspectScenario={onInspectScenario}
          />
        )}
      </div>
    </div>
  )
}
