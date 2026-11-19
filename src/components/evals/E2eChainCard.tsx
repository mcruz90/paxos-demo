import { useState } from 'react'
import { Workflow } from 'lucide-react'
import { DEFAULT_EVAL_SNAPSHOT, formatStageCount } from '../../data/evalSnapshot'
import type { E2eRun, E2eStage, EvalSnapshot } from '../../generated/evalSnapshotTypes'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

function formatPair(ok: number | null, total: number | null): string {
  if (ok === null || total === null) return '—'
  return `${formatStageCount(ok)} / ${formatStageCount(total)}`
}

function readNum(obj: Record<string, unknown>, key: string): number | null {
  const val = obj[key]
  return typeof val === 'number' && Number.isFinite(val) ? val : null
}

function DenialAndMissedSummary({ run }: { run: E2eRun }) {
  const byDenial = run.by_denial
  const missed = run.missed_appeals
  if (!byDenial && !missed) return null

  const correct = byDenial && typeof byDenial.correct === 'object' && byDenial.correct ? byDenial.correct as Record<string, unknown> : null
  const wrongful = byDenial && typeof byDenial.wrongful === 'object' && byDenial.wrongful ? byDenial.wrongful as Record<string, unknown> : null
  const missedCases = missed ? readNum(missed, 'cases') : null
  const missedOf = missed ? readNum(missed, 'of') : null

  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
      {correct && (
        <span className="px-2 py-0.5 rounded border border-slate-700/60 bg-slate-900/50 text-slate-300">
          correct denials: {formatStageCount(readNum(correct, 'pass'))} pass · {formatStageCount(readNum(correct, 'wrong'))} wrong · {formatStageCount(readNum(correct, 'silent'))} silent
        </span>
      )}
      {wrongful && (
        <span className="px-2 py-0.5 rounded border border-slate-700/60 bg-slate-900/50 text-slate-300">
          wrongful denials: {formatStageCount(readNum(wrongful, 'pass'))} pass · {formatStageCount(readNum(wrongful, 'wrong'))} wrong · {formatStageCount(readNum(wrongful, 'silent'))} silent
        </span>
      )}
      {missedCases !== null && missedOf !== null && (
        <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
          missed appeals: {missedCases} / {missedOf}
        </span>
      )}
    </div>
  )
}

function E2eStageRow({ stage }: { stage: E2eStage }) {
  const mismatches = (stage.run ?? 0) - (stage.ok ?? 0) - (stage.held ?? 0) - (stage.inherited ?? 0)
  return (
    <tr className="hover:bg-slate-700/20 transition-colors">
      <td className="px-3 py-2">
        <span className="font-medium text-slate-200">{stage.name}</span>
        <span className="ml-2 font-mono text-[10px] text-slate-400">{stage.id}</span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-slate-200 whitespace-nowrap">{formatPair(stage.ok, stage.run)}</td>
      <td className="px-3 py-2 text-right font-mono text-amber-300 whitespace-nowrap">{formatStageCount(stage.held)}</td>
      <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${stage.silent === 0 ? 'text-emerald-300' : 'text-red-300'}`}>
        {formatStageCount(stage.silent)}
      </td>
      <td className="px-3 py-2 text-right font-mono text-slate-400 whitespace-nowrap">
        {formatStageCount(stage.inherited)}{mismatches > 0 ? ` (+${mismatches})` : ''}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sky-300 whitespace-nowrap">
        {formatPair(stage.gold_fed_ok, stage.gold_fed_run)}
      </td>
    </tr>
  )
}

function E2eRunDetails({ run }: { run: E2eRun }) {
  const kpis = [
    { label: 'Cases', value: run.cases, cls: 'text-white' },
    { label: 'Pass', value: run.outcomes.pass, cls: 'text-emerald-300' },
    { label: 'Held', value: run.outcomes.held, cls: 'text-amber-300' },
    { label: 'Wrong', value: run.outcomes.wrong, cls: 'text-slate-300' },
    { label: 'Silent Errors', value: run.outcomes.silent, cls: run.outcomes.silent === 0 ? 'text-emerald-300' : 'text-red-300' },
  ]
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
            <p className="text-[11px] text-slate-400">{k.label}</p>
            <p className={`text-lg font-bold font-mono leading-tight ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <DenialAndMissedSummary run={run} />
      {run.first_failure.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">First-failure blame:</span>
          {run.first_failure.map(f => (
            <span key={f.id} className="px-2 py-0.5 rounded-full text-[11px] font-mono border border-amber-500/30 bg-amber-500/10 text-amber-300">
              {f.id}: {f.cases}
            </span>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-400 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2 font-medium">Chain Stage</th>
              <th className="text-right px-3 py-2 font-medium">Fed OK / Run</th>
              <th className="text-right px-3 py-2 font-medium">Held</th>
              <th className="text-right px-3 py-2 font-medium">Silent</th>
              <th className="text-right px-3 py-2 font-medium">Inherited</th>
              <th className="text-right px-3 py-2 font-medium">Gold-Fed OK / Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {run.stages.map(st => <E2eStageRow key={st.id} stage={st} />)}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function E2eChainCard({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  const [selectedFlow, setSelectedFlow] = useState<string>(snapshot?.e2e.runs[0]?.flow ?? 'appeal')
  if (!snapshot) return null

  const { e2e } = snapshot
  const activeRun = e2e.runs.find(r => r.flow === selectedFlow) ?? e2e.runs[0]

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">2. End-to-End Chain · Fed vs. Gold-Fed Totals &amp; Stage Blame</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={e2e.state} />
          <DecisionStatusBadge decision={e2e.decision} />
        </div>
      </div>

      {e2e.runs.length === 0 ? (
        <p className="text-xs text-slate-400">No end-to-end chain runs recorded in this snapshot.</p>
      ) : activeRun && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex items-center gap-1 bg-slate-900/70 border border-slate-700/60 rounded-lg p-1">
              {e2e.runs.map(r => (
                <button
                  key={r.run_id}
                  type="button"
                  onClick={() => setSelectedFlow(r.flow)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    activeRun.run_id === r.run_id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r.flow} · {r.cases} cases
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 flex-wrap">
              <span>{activeRun.run_id}</span>
              <span>· deid: {activeRun.deid}</span>
              {activeRun.fallback_model && <span>· model: {activeRun.fallback_model}</span>}
            </div>
          </div>
          <E2eRunDetails run={activeRun} />
        </>
      )}
    </div>
  )
}
