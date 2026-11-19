import { useState } from 'react'
import { ArrowRight, CheckCircle2, Cpu, GitCommit, Info, Layers, ShieldAlert, XCircle } from 'lucide-react'
import { GRADERS, METHODOLOGY_META, MOCK_EVAL_RUN } from '../data/evalRun'
import { DEFAULT_EVAL_SNAPSHOT, formatShortCommit } from '../data/evalSnapshot'
import { type CaseLink, type CaseStatus, type EvalMethodology, type MetricResult } from '../types'
import { ClearauthEvalStagesCard } from './evals/ClearauthEvalStagesCard'
import { E2eChainCard } from './evals/E2eChainCard'
import { PairedPromptsAndClocksCard } from './evals/PairedPromptsAndClocksCard'
import { CapabilityChip } from './live/CapabilityChip'
import { InfoHint, TierBadge } from './ui'

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)
const ACCENT: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  violet: { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20', dot: 'bg-violet-400' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  sky: { text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/20', dot: 'bg-sky-400' },
}
const CARD_ORDER: EvalMethodology[] = ['Deterministic', 'Entailment', 'Advisory Judge', 'Red-team']

function CellChip({ metric, active, onClick }: { metric: MetricResult; active: boolean; onClick?: () => void }) {
  if (metric.score === null || metric.notRun) {
    return (
      <span title="Defined in appeal_rubric.json — not run yet (advisory)" className="inline-block px-2 py-0.5 rounded text-xs font-mono border border-slate-700/60 bg-slate-900/40 text-slate-500">
        —
      </span>
    )
  }
  const clickable = !!metric.reason
  const cls = metric.passed ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-red-300 bg-red-500/10 border-red-500/30'
  return (
    <button type="button" disabled={!clickable} onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition ${cls} ${active ? 'ring-2 ring-red-400' : ''} ${clickable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}>
      {metric.score.toFixed(2)}
    </button>
  )
}

function CaseLinkButton({ link, onOpenCase }: { link: CaseLink; onOpenCase: (sid: string, st: CaseStatus) => void }) {
  return (
    <button type="button" onClick={() => onOpenCase(link.scenarioId, link.status)} className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 hover:text-emerald-200 hover:border-emerald-500/40 transition">
      Open {link.caseName} <ArrowRight className="w-3.5 h-3.5" />
    </button>
  )
}

function RuntimeSection({ run }: { run: typeof MOCK_EVAL_RUN }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Cpu className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-white">Runtime · Estimated Model Routing</h2>
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">{run.runtime.tracedIn}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Cost / case', value: `$${run.runtime.costPerCaseUsd.toFixed(3)}`, sub: 'illustrative estimate' },
          { label: 'Latency p50', value: fmtMs(run.runtime.p50Ms), sub: 'median wall-clock' },
          { label: 'Latency p95', value: fmtMs(run.runtime.p95Ms), sub: 'tail wall-clock' },
          { label: 'Tokens / case', value: run.runtime.tokensPerCase.toLocaleString(), sub: 'input + output' },
        ].map(t => (
          <div key={t.label} className="rounded-xl bg-slate-800/50 border border-slate-700/60 p-4">
            <p className="text-xs font-medium text-slate-400 mb-1.5">{t.label}</p>
            <p className="text-2xl font-bold font-mono text-slate-100 leading-none">{t.value}</p>
            <p className="text-xs text-slate-500 mt-2">{t.sub}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {run.runtime.nodes.map(n => {
          const det = n.costUsd === 0
          return (
            <div key={n.node} className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">{n.node}</span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${det ? 'text-sky-300 bg-sky-500/10 border-sky-500/20' : 'text-violet-300 bg-violet-500/10 border-violet-500/20'}`}>{n.model}</span>
                <div className="ml-auto flex items-center gap-4 font-mono text-xs text-slate-400">
                  <span>{fmtMs(n.p50Ms)} / {fmtMs(n.p95Ms)}</span><span>{det ? '$0' : `$${n.costUsd.toFixed(3)}`}</span><span>{det ? '—' : `${n.tokens.toLocaleString()} tok`}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-2">{n.rationale}</p>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mt-3 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{run.runtime.note}</p>
    </div>
  )
}

function RedTeamSection({ run, onOpenCase }: { run: typeof MOCK_EVAL_RUN; onOpenCase: (sid: string, st: CaseStatus) => void }) {
  const blocked = run.redTeam.reduce((a, p) => a + p.blocked, 0)
  const total = run.redTeam.reduce((a, p) => a + p.probes, 0)
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-400" /> Red-Team Probes (Demo Fixture)</h2>
      <p className="text-xs text-slate-500 mb-3">Illustrative adversarial probes — {blocked}/{total} blocked.</p>
      <div className="space-y-2">
        {run.redTeam.map(p => {
          const clean = p.passRate === 1
          return (
            <div key={p.category} className={`rounded-xl border p-4 ${clean ? 'border-slate-700/60 bg-slate-800/40' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold ${clean ? 'text-slate-200' : 'text-amber-300'}`}>{p.category}</span>
                <span className="text-xs text-slate-500">— {p.attack}</span>
                <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${clean ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                  {clean ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} {p.blocked}/{p.probes} blocked
                </span>
              </div>
              {p.reason && (<><p className="text-sm text-slate-300 leading-relaxed mt-3">{p.reason}</p>{p.caseLink && <div className="mt-3"><CaseLinkButton link={p.caseLink} onOpenCase={onOpenCase} /></div>}</>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HarnessSnapshotBlock() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Harness Snapshot · Real Data from clearauth-eval</h2>
        </div>
        {DEFAULT_EVAL_SNAPSHOT && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <GitCommit className="w-3 h-3" />
            v{DEFAULT_EVAL_SNAPSHOT.schema_version} · {formatShortCommit(DEFAULT_EVAL_SNAPSHOT.as_of_commit)}
          </span>
        )}
      </div>
      <ClearauthEvalStagesCard snapshot={DEFAULT_EVAL_SNAPSHOT} />
      {DEFAULT_EVAL_SNAPSHOT && <E2eChainCard snapshot={DEFAULT_EVAL_SNAPSHOT} />}
      {DEFAULT_EVAL_SNAPSHOT && <PairedPromptsAndClocksCard snapshot={DEFAULT_EVAL_SNAPSHOT} />}
    </div>
  )
}

export function EvalRunResultsPanel({ onOpenCase }: { onOpenCase: (scenarioId: string, status: CaseStatus) => void }) {
  const run = MOCK_EVAL_RUN
  const [selected, setSelected] = useState<{ caseId: string; idx: number } | null>(null)
  const casesPassed = run.results.filter(r => r.overallPassed).length
  const redBlocked = run.redTeam.reduce((a, p) => a + p.blocked, 0)
  const redTotal = run.redTeam.reduce((a, p) => a + p.probes, 0)
  const allPass = casesPassed === run.results.length && redBlocked === redTotal

  const groups: { methodology: EvalMethodology; count: number }[] = []
  GRADERS.forEach(g => { const last = groups.at(-1); if (last && last.methodology === g.methodology) last.count++; else groups.push({ methodology: g.methodology, count: 1 }) })
  const summary = (mth: EvalMethodology) => {
    if (mth === 'Red-team') return { passed: redBlocked, total: redTotal, notBuilt: false, items: run.redTeam.map(p => ({ label: p.category, measures: p.attack })) }
    const items = GRADERS.filter(g => g.methodology === mth).map(g => ({ label: g.dimension, measures: g.measures }))
    if (mth === 'Advisory Judge') return { passed: 0, total: items.length, notBuilt: true, items }
    const cells = run.results.flatMap(r => r.metrics.filter(x => x.methodology === mth))
    return { passed: cells.filter(c => c.passed).length, total: cells.length, notBuilt: false, items }
  }
  const selectedCase = selected ? run.results.find(r => r.caseId === selected.caseId) : null
  const selectedMetric = selectedCase && selected ? selectedCase.metrics[selected.idx] : null

  return (
    <div className="space-y-8">
      <HarnessSnapshotBlock />

      <div className="border-t border-slate-800 pt-6 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-white">Demo Fixture Preview · Illustrative Per-Case Matrix</h2>
            <CapabilityChip cap="simulated" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${allPass ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
              {allPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />} Fixture {casesPassed} / {run.results.length} passing
            </span>
            <span className="text-[11px] font-mono text-slate-400">{run.runId}</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">Illustrative walkthrough scores below use local fixture cases ({run.platform}); not produced by clearauth-eval. Advisory Judge J1–J4 remain unbuilt until clinician calibration completes.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {CARD_ORDER.map(mth => {
          const s = summary(mth); const a = ACCENT[METHODOLOGY_META[mth].accent]
          return (
            <div key={mth} className={`rounded-xl border ${a.border} ${a.bg} p-4`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                <h3 className={`text-sm font-semibold ${a.text}`}>{mth}</h3>
                {s.notBuilt ? (
                  <span className="ml-auto font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-600/40 text-slate-300">not built</span>
                ) : (
                  <span className={`ml-auto font-mono text-xs font-semibold ${s.passed === s.total ? 'text-emerald-300' : 'text-amber-300'}`}>{s.passed}/{s.total}</span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-2.5">{METHODOLOGY_META[mth].blurb}</p>
              <div className="space-y-1 mb-2.5">{s.items.map(it => <div key={it.label} className="flex items-center gap-1 text-[11px] text-slate-300"><span>{it.label}</span><InfoHint text={it.measures} wide /></div>)}</div>
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/30">{METHODOLOGY_META[mth].method}</span>
            </div>
          )
        })}
      </div>

      <RuntimeSection run={run} />

      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Per-Case Fixture Scores (Advisory J1–J4 Columns Not Run)</h2>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/40 text-slate-500 uppercase tracking-wide">
                <th rowSpan={2} className="text-left px-4 py-2 font-medium align-bottom">Case</th>
                <th rowSpan={2} className="text-center px-3 py-2 font-medium align-bottom">Tier</th>
                {groups.map(grp => <th key={grp.methodology} colSpan={grp.count} className={`text-center px-3 pt-2 pb-1 font-semibold normal-case ${ACCENT[METHODOLOGY_META[grp.methodology].accent].text}`}>{grp.methodology}</th>)}
              </tr>
              <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                {GRADERS.map(g => <th key={g.dimension} className="text-center px-3 pb-2 font-medium normal-case text-slate-400 align-top">{g.dimension}<span className="block text-[10px] text-slate-600 font-mono">{g.status === 'not_built' ? 'not built' : `≥ ${g.threshold.toFixed(2)}`}</span></th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {run.results.map(r => (
                <tr key={r.caseId} className={r.overallPassed ? 'hover:bg-slate-700/20' : 'bg-red-500/[0.04]'}>
                  <td className="px-4 py-3 font-mono text-emerald-400 whitespace-nowrap">{r.caseId}</td>
                  <td className="px-3 py-3 text-center"><TierBadge tier={r.tier} /></td>
                  {r.metrics.map((metric, i) => <td key={i} className="px-3 py-3 text-center"><CellChip metric={metric} active={selected?.caseId === r.caseId && selected?.idx === i} onClick={() => setSelected({ caseId: r.caseId, idx: i })} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMetric && selectedCase && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <XCircle className="w-4 h-4 text-red-400" /><span className="font-mono text-xs text-slate-200">{selectedCase.caseId}</span><span className="text-slate-600">·</span><span className="text-xs text-slate-300 font-mono">{selectedMetric.grader}</span>
            <span className="ml-auto font-mono text-xs"><span className="text-red-300 font-semibold">{selectedMetric.score !== null ? selectedMetric.score.toFixed(2) : '—'}</span> / {selectedMetric.threshold.toFixed(2)}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{selectedMetric.reason}</p>
          {selectedMetric.caseLink && <CaseLinkButton link={selectedMetric.caseLink} onOpenCase={onOpenCase} />}
        </div>
      )}

      <RedTeamSection run={run} onOpenCase={onOpenCase} />
    </div>
  )
}
