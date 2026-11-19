import { Clock, Layers } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  formatStageCount,
  formatStageTargetSummary,
  formatWilsonRange,
  summarizeReadiness,
} from '../../data/evalSnapshot'
import type { EvalSnapshot, Stage } from '../../generated/evalSnapshotTypes'
import { EVAL_SNAPSHOT_PLACEHOLDER } from '../inspector/inspectorModel'
import { DecisionStatusBadge, SectionStateBadge, SnapshotProvenanceBar, StageStateBadge } from './SnapshotBadges'

function StagePresenceBadge({ inClearauth }: { inClearauth: Stage['in_clearauth'] }) {
  if (inClearauth === true) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 whitespace-nowrap">
        In ClearAuth
      </span>
    )
  }
  if (inClearauth === false) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-600/60 bg-slate-900/60 text-slate-400 whitespace-nowrap">
        Harness only
      </span>
    )
  }
  return <span className="text-xs font-mono text-slate-500">—</span>
}

function formatRightMetric(stage: Stage): string {
  if (!stage.right) return '—'
  const pct = stage.right.n > 0 ? Math.round((stage.right.k / stage.right.n) * 100) : null
  return pct !== null
    ? `${stage.right.k.toLocaleString('en-US')}/${stage.right.n.toLocaleString('en-US')} (${pct}%)`
    : `${stage.right.k}/${stage.right.n}`
}

function ReadinessEmptyFallback() {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">clearauth-eval · Pipeline Readiness Snapshot</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full border border-slate-600/60 bg-slate-900/60 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {EVAL_SNAPSHOT_PLACEHOLDER.state} · awaiting eval_snapshot.json
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{EVAL_SNAPSHOT_PLACEHOLDER.detail}</p>
    </div>
  )
}

function TargetedStageRow({ stage }: { stage: Stage }) {
  return (
    <tr className="hover:bg-slate-700/20 transition-colors align-top">
      <td className="px-3.5 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-200">{stage.name}</span>
          <span className="font-mono text-[10px] text-slate-400 bg-slate-900/60 border border-slate-700/50 px-1.5 py-0.5 rounded">
            {stage.id}
          </span>
          <StagePresenceBadge inClearauth={stage.in_clearauth} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{stage.why}</p>
        {stage.lead && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{stage.lead}</p>}
        <p className="text-[10px] font-mono text-slate-500 mt-1">Target: {formatStageTargetSummary(stage)}</p>
      </td>
      <td className="px-3 py-3 text-center whitespace-nowrap"><StageStateBadge state={stage.state} /></td>
      <td className="px-3 py-3 text-right font-mono whitespace-nowrap">
        <span className={stage.errors === 0 ? 'text-emerald-300 font-semibold' : typeof stage.errors === 'number' ? 'text-amber-300 font-semibold' : 'text-slate-500'}>
          {formatStageCount(stage.errors)}
        </span>
      </td>
      <td className="px-3 py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatStageCount(stage.n)}</td>
      <td className="px-3 py-3 text-right font-mono text-slate-400 whitespace-nowrap">{formatWilsonRange(stage.error_range95)}</td>
      <td className="px-3 py-3 text-right font-mono text-slate-300 whitespace-nowrap">{formatRightMetric(stage)}</td>
    </tr>
  )
}

function ReadinessCountsGrid({ stages }: { stages: Stage[] }) {
  const counts = summarizeReadiness(stages)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {[
        { label: 'Ready', value: counts.ready, cls: 'text-emerald-300' },
        { label: 'Not Yet', value: counts.notYet, cls: 'text-amber-300' },
        { label: 'No Runs', value: counts.noRuns, cls: 'text-slate-300' },
        { label: 'Not Built', value: counts.notBuilt, cls: 'text-slate-400' },
      ].map(stat => (
        <div key={stat.label} className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
          <p className="text-[11px] text-slate-400">{stat.label}</p>
          <p className={`text-lg font-bold font-mono leading-tight ${stat.cls}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

function UnbuiltStagesStrip({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Stages Not Built ({stages.length})
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {stages.map(stage => (
          <div key={stage.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">{stage.name}</span>
              <StageStateBadge state={stage.state} />
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{stage.why}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ClearauthEvalStagesCard({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  if (!snapshot) return <ReadinessEmptyFallback />

  const { readiness } = snapshot
  const targeted = readiness.stages.filter(s => s.state !== 'not_built')
  const unbuilt = readiness.stages.filter(s => s.state === 'not_built')

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">1. Readiness per Stage · targets.json</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={readiness.state} />
          <DecisionStatusBadge decision={readiness.decision} />
        </div>
      </div>

      <SnapshotProvenanceBar snapshot={snapshot} />
      <ReadinessCountsGrid stages={readiness.stages} />

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-400 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3.5 py-2.5 font-medium">Stage &amp; Verdict</th>
              <th className="text-center px-3 py-2.5 font-medium">State</th>
              <th className="text-right px-3 py-2.5 font-medium">Errors</th>
              <th className="text-right px-3 py-2.5 font-medium">Sample n</th>
              <th className="text-right px-3 py-2.5 font-medium">Wilson 95% CI</th>
              <th className="text-right px-3 py-2.5 font-medium">Right / Hands-off</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {targeted.map(stage => <TargetedStageRow key={stage.id} stage={stage} />)}
          </tbody>
        </table>
      </div>

      <UnbuiltStagesStrip stages={unbuilt} />
    </div>
  )
}
