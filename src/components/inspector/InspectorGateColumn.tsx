import { CheckCircle2, Cpu, Link2, ShieldCheck, XCircle } from 'lucide-react'
import { GRADERS, MOCK_EVAL_RUN } from '../../data/evalRun'
import type { DoneEvent } from '../../lib/wire'
import type { ScenarioConfig } from '../../types'
import { CapabilityChip } from '../live/CapabilityChip'
import type { LiveStep } from '../poc/live/appealEvents'
import { StepList } from '../poc/live/StepList'
import { TierBadge } from '../ui'
import { type GateAssertion, buildGateAssertions, buildRunMetadata } from './inspectorModel'

function GateRow({
  gate,
  activeCiteIndex,
  onSelectCiteIndex,
}: {
  gate: GateAssertion
  activeCiteIndex: number | null
  onSelectCiteIndex: (idx: number) => void
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
      type="button"
      disabled={!linkable}
      title={gate.label}
      onClick={() => { if (linkable) onSelectCiteIndex(gate.targetCiteIndex!) }}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left text-[11px] transition-colors ${
        isLinked ? 'bg-violet-500/15 border-violet-500/40' : 'bg-slate-950/60 border-slate-800/80'
      } ${linkable ? 'hover:border-violet-500/40 cursor-pointer' : 'cursor-default'}`}
    >
      <span className="flex items-center gap-2 text-slate-300 min-w-0 flex-1">
        {icon}
        <span className="truncate">{gate.label}</span>
      </span>
      <span className={`${valueColor} font-semibold whitespace-nowrap shrink-0 flex items-center gap-1`}>
        {gate.value}
        {linkable && <Link2 className="w-3 h-3 text-slate-500" />}
      </span>
    </button>
  )
}

function BenchmarkPreviewCard({ drugKey }: { drugKey: string }) {
  const caseEval = MOCK_EVAL_RUN.results.find(r => r.caseId.includes(drugKey)) ?? MOCK_EVAL_RUN.results[0]
  const ragas = caseEval?.metrics.find(m => m.grader === 'ragas.faithfulness')
  const judgeEntries = (caseEval?.metrics ?? [])
    .map((m, idx) => ({ m, dim: GRADERS[idx]?.dimension ?? `${m.grader} #${idx + 1}` }))
    .filter(x => x.m.methodology === 'LLM-as-judge')

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          Offline Suite Preview
        </span>
        <CapabilityChip cap="simulated" />
      </div>
      <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
        Illustrative benchmark fixture — not a run result for this case ({caseEval?.caseId}).
      </p>
      {ragas && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-slate-300 truncate">RAGAS Faithfulness</span>
            <span className="font-mono text-slate-300 shrink-0">{(ragas.score * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-slate-500" style={{ width: `${Math.round(ragas.score * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="space-y-1.5 pt-1">
        {judgeEntries.map(({ m, dim }) => (
          <div key={`${m.grader}-${dim}`} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-400 truncate">{dim}</span>
              <span className="font-mono text-violet-300 shrink-0">{Math.round(m.score * 100)}%</span>
            </div>
            <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-violet-500/70 rounded-full" style={{ width: `${Math.round(m.score * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CriterionTraceList({
  scenario,
  activeCiteIndex,
  onSelectCiteIndex,
}: {
  scenario: ScenarioConfig
  activeCiteIndex: number | null
  onSelectCiteIndex: (idx: number) => void
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-violet-400" />
          Criterion Grounding Trace
        </span>
        <span className="text-[10px] text-slate-500">Syncs to Col 1</span>
      </div>
      <div className="space-y-1">
        {scenario.criteriaResults.map((cr, idx) => {
          const active = activeCiteIndex === idx
          const ok = cr.status === 'found'
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectCiteIndex(idx)}
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
  scenario,
  done,
  steps,
  streaming,
  activeCiteIndex,
  onSelectCiteIndex,
}: {
  scenario: ScenarioConfig
  done?: DoneEvent | null
  steps: LiveStep[]
  streaming: boolean
  activeCiteIndex: number | null
  onSelectCiteIndex: (idx: number) => void
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
          {gates.map(g => (
            <GateRow key={g.key} gate={g} activeCiteIndex={activeCiteIndex} onSelectCiteIndex={onSelectCiteIndex} />
          ))}
        </div>
      </div>

      <CriterionTraceList scenario={scenario} activeCiteIndex={activeCiteIndex} onSelectCiteIndex={onSelectCiteIndex} />
      <BenchmarkPreviewCard drugKey={scenario.drugKey} />

      {steps.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Live Pipeline Steps</p>
          <StepList steps={steps} streaming={streaming} />
        </div>
      )}
    </div>
  )
}
