import { CheckCircle2, Clock, GitCommit, Hammer, Layers } from 'lucide-react'
import { EVAL_SNAPSHOT_SOURCE_NOTE, formatShortCommit, isDecisionAccepted } from '../../data/evalSnapshot'
import type { Decision, EvalSnapshot, SectionState, Stage } from '../../generated/evalSnapshotTypes'

const SECTION_STATE_STYLE: Record<SectionState, { label: string; cls: string }> = {
  measured: { label: 'measured', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  defined: { label: 'defined (not run)', cls: 'border-violet-500/30 bg-violet-500/10 text-violet-300' },
  not_run: { label: 'not_run', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  not_built: { label: 'not_built', cls: 'border-slate-600/60 bg-slate-800/70 text-slate-400' },
}

const STAGE_STATE_STYLE: Record<Stage['state'], { label: string; cls: string }> = {
  ready: { label: 'ready', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  not_yet: { label: 'not yet', cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
  no_runs: { label: 'no runs', cls: 'border-slate-600/60 bg-slate-900/60 text-slate-400' },
  not_built: { label: 'not built', cls: 'border-slate-700 bg-slate-900/50 text-slate-400' },
}

export function SectionStateBadge({ state }: { state: SectionState }) {
  const s = SECTION_STATE_STYLE[state]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border whitespace-nowrap ${s.cls}`}>
      {state === 'measured' ? <CheckCircle2 className="w-3 h-3" /> : state === 'not_built' ? <Hammer className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {s.label}
    </span>
  )
}

export function StageStateBadge({ state }: { state: Stage['state'] }) {
  const s = STAGE_STATE_STYLE[state]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function DecisionStatusBadge({ decision }: { decision: Decision }) {
  const accepted = isDecisionAccepted(decision)
  const cls = accepted
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return (
    <span
      title={decision.status}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border whitespace-nowrap ${cls}`}
    >
      ADR {decision.number} · {accepted ? 'Accepted' : 'Proposed'}
    </span>
  )
}

export function SnapshotProvenanceBar({ snapshot }: { snapshot: EvalSnapshot }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3.5 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2 font-mono text-slate-300">
          <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-white">Example · eval_snapshot.json</span>
          <span className="text-emerald-300">v{snapshot.schema_version}</span>
          <span className="inline-flex items-center gap-1 text-slate-400">
            <GitCommit className="w-3 h-3" />
            {formatShortCommit(snapshot.as_of_commit)}
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-400">
          generated {snapshot.generated_at}
        </span>
      </div>
      <p className="text-[11px] font-medium text-amber-300 leading-snug">{EVAL_SNAPSHOT_SOURCE_NOTE}</p>
      <p className="text-[11px] text-slate-400 leading-relaxed">{snapshot.basis}</p>
    </div>
  )
}
