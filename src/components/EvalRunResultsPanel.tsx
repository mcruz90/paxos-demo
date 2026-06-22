import { useState } from 'react'
import { RotateCcw, ArrowRight, CheckCircle2, XCircle, ShieldAlert, Info, Cpu } from 'lucide-react'
import { type CaseLink, type CaseStatus, type EvalMethodology, type MetricResult } from '../types'
import { GRADERS, METHODOLOGY_META, MOCK_EVAL_RUN } from '../data/evalRun'
import { InfoHint, TierBadge } from './ui'

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`)

// Static accent class maps (no string interpolation, so Tailwind keeps them).
const ACCENT: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  violet:  { text: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400' },
  amber:   { text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400' },
  sky:     { text: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-400' },
}

const CARD_ORDER: EvalMethodology[] = ['Deterministic', 'RAGAS', 'LLM-as-judge', 'Red-team']

function CellChip({ metric, active, onClick }: { metric: MetricResult; active: boolean; onClick?: () => void }) {
  const clickable = !!metric.reason
  const cls = metric.passed
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
    : 'text-red-300 bg-red-500/10 border-red-500/30'
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs font-mono font-semibold border transition ${cls} ${active ? 'ring-2 ring-red-400' : ''} ${clickable ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}`}
    >
      {metric.score.toFixed(2)}
    </button>
  )
}

// A button that deep-links to the real case/scenario exhibiting a failure.
function CaseLinkButton({ link, onOpenCase }: { link: CaseLink; onOpenCase: (scenarioId: string, status: CaseStatus) => void }) {
  return (
    <button
      onClick={() => onOpenCase(link.scenarioId, link.status)}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-emerald-300 hover:text-emerald-200 hover:border-emerald-500/40 transition"
    >
      Open {link.caseName} <ArrowRight className="w-3.5 h-3.5" />
    </button>
  )
}

export function EvalRunResultsPanel({ onOpenCase }: { onOpenCase: (scenarioId: string, status: CaseStatus) => void }) {
  const run = MOCK_EVAL_RUN
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<{ caseId: string; idx: number } | null>(null)

  const casesPassed = run.results.filter(r => r.overallPassed).length
  const total = run.results.length
  const redTeamBlocked = run.redTeam.reduce((a, p) => a + p.blocked, 0)
  const redTeamTotal = run.redTeam.reduce((a, p) => a + p.probes, 0)
  const allPass = casesPassed === total && redTeamBlocked === redTeamTotal

  // Column groups for the matrix header (consecutive graders sharing a methodology).
  const groups: { methodology: EvalMethodology; count: number }[] = []
  GRADERS.forEach(g => {
    const last = groups[groups.length - 1]
    if (last && last.methodology === g.methodology) last.count++
    else groups.push({ methodology: g.methodology, count: 1 })
  })

  // Per-methodology aggregate + the dimensions it covers, for the summary cards.
  const summary = (mth: EvalMethodology) => {
    if (mth === 'Red-team') {
      return { passed: redTeamBlocked, total: redTeamTotal, items: run.redTeam.map(p => ({ label: p.category, measures: p.attack })) }
    }
    const cells = run.results.flatMap(r => r.metrics.filter(x => x.methodology === mth))
    const items = GRADERS.filter(g => g.methodology === mth).map(g => ({ label: g.dimension, measures: g.measures }))
    return { passed: cells.filter(c => c.passed).length, total: cells.length, items }
  }

  const rerun = () => { setRunning(true); setSelected(null); setTimeout(() => setRunning(false), 500) }

  const selectedCase = selected ? run.results.find(r => r.caseId === selected.caseId) : null
  const selectedMetric = selectedCase && selected ? selectedCase.metrics[selected.idx] : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">{run.platform}</span>
          <span className="text-xs text-slate-500 font-mono">{run.runId}</span>
          <span className="text-xs text-slate-600">· {run.timestamp}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${allPass ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
            {allPass ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {casesPassed} / {total} cases
          </span>
          <span className="text-xs text-slate-400 font-mono px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">{run.durationSeconds}s</span>
          <button
            onClick={rerun}
            disabled={running}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-600 transition disabled:opacity-60"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Running…' : 'Re-run'}
          </button>
        </div>
      </div>

      {/* Methodology summary — each measures a different facet; they all run together */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Methodology Suite</h2>
        <p className="text-xs text-slate-500 mb-3">Four methods score the system in parallel — they don't compete, each catches a different failure mode. Hover a dimension for what it measures.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {CARD_ORDER.map(mth => {
            const s = summary(mth)
            const a = ACCENT[METHODOLOGY_META[mth].accent]
            const clean = s.passed === s.total
            return (
              <div key={mth} className={`rounded-xl border ${a.border} ${a.bg} p-4`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                  <h3 className={`text-sm font-semibold ${a.text}`}>{mth}</h3>
                  <span className={`ml-auto font-mono text-xs font-semibold ${clean ? 'text-emerald-300' : 'text-amber-300'}`}>{s.passed}/{s.total}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-2.5">{METHODOLOGY_META[mth].blurb}</p>
                <div className="space-y-1 mb-2.5">
                  {s.items.map(it => (
                    <div key={it.label} className="flex items-center gap-1 text-[11px] text-slate-300">
                      <span>{it.label}</span>
                      <InfoHint text={it.measures} wide />
                    </div>
                  ))}
                </div>
                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/30">{METHODOLOGY_META[mth].method}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Runtime — cost, latency & model routing (read from Langfuse, not recomputed here) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Runtime · Cost, Latency &amp; Model Routing</h2>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">traced in {run.runtime.tracedIn}</span>
        </div>
        <p className="text-xs text-slate-500 mb-3">What each case costs and how long it takes — the model is routed per node to balance cost against quality. The Gatekeeper runs no model at all.</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Cost / case', value: `$${run.runtime.costPerCaseUsd.toFixed(3)}`, sub: 'end-to-end, all nodes' },
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
                    <span title="median / p95 latency">{fmtMs(n.p50Ms)} <span className="text-slate-600">/ {fmtMs(n.p95Ms)}</span></span>
                    <span title="cost per case">{det ? '$0' : `$${n.costUsd.toFixed(3)}`}</span>
                    <span title="tokens per case">{det ? '—' : `${n.tokens.toLocaleString()} tok`}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mt-2">{n.rationale}</p>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-600 leading-relaxed mt-3 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{run.runtime.note}
        </p>
      </div>

      {/* Per-case test matrix, columns grouped by methodology */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Per-Case Scores</h2>
        <p className="text-xs text-slate-500 mb-3">Representative subset — {total} of {run.suiteSize} suite cases shown. Each case scored by every per-case metric; click a failing score to inspect it.</p>
        <div className={`bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-x-auto transition-opacity ${running ? 'opacity-40 animate-pulse' : ''}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/40 text-slate-500 uppercase tracking-wide">
                <th rowSpan={2} className="text-left px-4 py-2 font-medium align-bottom">Case</th>
                <th rowSpan={2} className="text-center px-3 py-2 font-medium align-bottom">Tier</th>
                {groups.map(grp => {
                  const a = ACCENT[METHODOLOGY_META[grp.methodology].accent]
                  return <th key={grp.methodology} colSpan={grp.count} className={`text-center px-3 pt-2 pb-1 font-semibold normal-case ${a.text}`}>{grp.methodology}</th>
                })}
              </tr>
              <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                {GRADERS.map(g => (
                  <th key={g.dimension} className="text-center px-3 pb-2 font-medium normal-case text-slate-400 align-top">
                    {g.dimension}
                    <span className="block text-[10px] text-slate-600 font-mono">≥ {g.threshold.toFixed(2)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {run.results.map(r => (
                <tr key={r.caseId} className={`transition-colors ${r.overallPassed ? 'hover:bg-slate-700/20' : 'bg-red-500/[0.04]'}`}>
                  <td className="px-4 py-3 font-mono text-emerald-400 whitespace-nowrap">{r.caseId}</td>
                  <td className="px-3 py-3 text-center"><TierBadge tier={r.tier} /></td>
                  {r.metrics.map((metric, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      <CellChip
                        metric={metric}
                        active={selected?.caseId === r.caseId && selected?.idx === i}
                        onClick={() => setSelected({ caseId: r.caseId, idx: i })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-case drill-down */}
      {selectedMetric && selectedCase && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="font-mono text-xs text-slate-200">{selectedCase.caseId}</span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-300 border border-slate-600/30">{selectedMetric.methodology}</span>
            <span className="text-xs text-slate-300 font-mono">{selectedMetric.grader}</span>
            <span className="ml-auto font-mono text-xs">
              <span className="text-red-300 font-semibold">{selectedMetric.score.toFixed(2)}</span>
              <span className="text-slate-500"> / {selectedMetric.threshold.toFixed(2)} threshold</span>
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{selectedMetric.reason}</p>
          {selectedMetric.caseLink && <CaseLinkButton link={selectedMetric.caseLink} onOpenCase={onOpenCase} />}
        </div>
      )}

      {/* Red-team probes — system-level adversarial evaluation */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" /> Red-Team Probes
        </h2>
        <p className="text-xs text-slate-500 mb-3">Adversarial attacks run against the whole pipeline — scored by how many the system withstood. {redTeamBlocked}/{redTeamTotal} blocked.</p>
        <div className="space-y-2">
          {run.redTeam.map(p => {
            const clean = p.passRate === 1
            return (
              <div key={p.category} className={`rounded-xl border p-4 ${clean ? 'border-slate-700/60 bg-slate-800/40' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${clean ? 'text-slate-200' : 'text-amber-300'}`}>{p.category}</span>
                  <span className="text-xs text-slate-500">— {p.attack}</span>
                  <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border ${clean ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                    {clean ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {p.blocked}/{p.probes} blocked
                  </span>
                </div>
                {p.reason && (
                  <>
                    <p className="text-sm text-slate-300 leading-relaxed mt-3">{p.reason}</p>
                    {p.caseLink && <div className="mt-3"><CaseLinkButton link={p.caseLink} onOpenCase={onOpenCase} /></div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
