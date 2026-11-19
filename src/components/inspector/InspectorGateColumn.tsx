import { CheckCircle2, Clock, Cpu, Link2, ShieldCheck, XCircle } from 'lucide-react'
import type { DoneEvent } from '../../lib/wire'
import type { ScenarioConfig } from '../../types'
import type { LiveStep } from '../poc/live/appealEvents'
import { StepList } from '../poc/live/StepList'
import { TierBadge } from '../ui'
import { type GateAssertion, EVAL_SNAPSHOT_PLACEHOLDER, buildGateAssertions, buildRunMetadata } from './inspectorModel'

function GateRow({
  gate, activeCiteIndex, onSelectCiteIndex,
}: {
  gate: GateAssertion; activeCiteIndex: number | null; onSelectCiteIndex: (idx: number) => void
}) {
  const linkable = gate.targetCiteIndex !== undefined
  const isLinked = linkable && activeCiteIndex === gate.targetCiteIndex
  const icon = gate.status === 'pass'
    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
    : gate.status === 'fail'
      ? <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
      : <span className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
  const valueColor = gate.status === 'pass' ? 'text-emerald-300' : gate.status === 'fail' ? 'text-red-300' : 'text-slate-400'

  return (
    <button
      type="button" disabled={!linkable} title={gate.label}
      onClick={() => { if (linkable) onSelectCiteIndex(gate.targetCiteIndex!) }}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
        isLinked ? 'bg-violet-500/15 border-violet-500/40' : 'bg-slate-950/60 border-slate-800/80'
      } ${linkable ? 'hover:border-violet-500/40 cursor-pointer' : 'cursor-default'}`}
    >
      <span className="flex items-center gap-2 text-slate-300 min-w-0 flex-1">{icon}<span className="truncate">{gate.label}</span></span>
      <span className={`${valueColor} font-semibold whitespace-nowrap shrink-0 flex items-center gap-1`}>
        {gate.value}
        {linkable && <Link2 className="w-3 h-3 text-slate-500" />}
      </span>
    </button>
  )
}

function SnapshotEmptyStateCard() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          Harness Snapshot Status
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700 bg-slate-950/70 text-slate-300">
          <Clock className="w-3 h-3 text-slate-400" />
          {EVAL_SNAPSHOT_PLACEHOLDER.state}
        </span>
      </div>
      <p className="text-xs font-medium text-slate-200">{EVAL_SNAPSHOT_PLACEHOLDER.label}</p>
      <p className="text-[11px] text-slate-400 leading-relaxed">{EVAL_SNAPSHOT_PLACEHOLDER.detail}</p>
    </div>
  )
}

function CriterionTraceList({
  scenario, activeCiteIndex, onSelectCiteIndex,
}: {
  scenario: ScenarioConfig; activeCiteIndex: number | null; onSelectCiteIndex: (idx: number) => void
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-violet-400" />Criterion Grounding Trace
        </span>
        <span className="text-[10px] text-slate-500">Syncs to Col 1</span>
      </div>
      <div className="space-y-1">
        {scenario.criteriaResults.map((cr, idx) => {
          const active = activeCiteIndex === idx
          const ok = cr.status === 'found'
          return (
            <button
              key={idx} type="button" onClick={() => onSelectCiteIndex(idx)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-colors ${
                active ? 'bg-violet-500/15 border-violet-500/45 text-white' : 'bg-slate-950/50 border-slate-800/70 text-slate-300 hover:border-slate-700'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  cr.status === 'conflict' ? 'bg-red-400' : cr.status === 'needs_review' ? 'bg-amber-400' : 'bg-emerald-400'
                }`} />
                <span className="truncate font-medium">{idx + 1}. {cr.rule.label}</span>
              </span>
              <span className={`font-mono text-[10px] shrink-0 ${ok ? 'text-emerald-300' : cr.status === 'conflict' ? 'text-red-300' : 'text-amber-300'}`}>
                {ok ? 'CITED' : cr.status === 'conflict' ? 'CONFLICT' : 'OPEN'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function InspectorGateColumn({
  scenario, done, steps, streaming, activeCiteIndex, onSelectCiteIndex,
}: {
  scenario: ScenarioConfig; done?: DoneEvent | null; steps: LiveStep[]; streaming: boolean
  activeCiteIndex: number | null; onSelectCiteIndex: (idx: number) => void
}) {
  const meta = buildRunMetadata(done)
  const gates = buildGateAssertions(done?.structural_scores, scenario)
  const evaluated = gates.filter(g => g.status !== 'not_evaluated')
  const passCount = gates.filter(g => g.status === 'pass').length

  return (
    <div className="lg:col-span-4 border-r border-slate-800 overflow-y-auto p-4 space-y-3.5">
      <div className="pb-2.5 border-b border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Cpu className="w-4 h-4 text-violet-400 shrink-0" />
            <h2 className="text-sm font-semibold text-white">Eval harness (clearauth-eval)</h2>
          </div>
          <span className="font-mono text-[11px] text-slate-400 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 whitespace-nowrap">
            run: {meta.correlationId}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
          <span className="text-slate-400 font-mono truncate">model: {meta.model}</span>
          <div className="flex items-center gap-2 shrink-0">
            {meta.tier && <TierBadge tier={meta.tier} />}
            <span className="font-mono text-slate-300 text-[11px]">art: {meta.artifactRef}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />
            Safety Gate ({evaluated.length > 0 ? `${passCount}/${gates.length}` : 'not evaluated'})
          </span>
          <span className="text-[10px] text-slate-500">Click rule to trace span</span>
        </div>
        <div className="space-y-1 font-mono text-xs">
          {gates.map(g => <GateRow key={g.key} gate={g} activeCiteIndex={activeCiteIndex} onSelectCiteIndex={onSelectCiteIndex} />)}
        </div>
      </div>

      <CriterionTraceList scenario={scenario} activeCiteIndex={activeCiteIndex} onSelectCiteIndex={onSelectCiteIndex} />
      <SnapshotEmptyStateCard />

      {steps.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Live Pipeline Steps</p>
          <StepList steps={steps} streaming={streaming} />
        </div>
      )}
    </div>
  )
}
