import { Boxes, CheckCircle, ChevronRight, Clock, GitCommit, Loader2, Rocket, Workflow } from 'lucide-react'
import { METHOD_LABEL, RUBRIC_DIMENSIONS, thresholdLabel } from '../data/evalRubric'
import { DEFAULT_EVAL_SNAPSHOT, formatShortCommit, summarizeReadiness } from '../data/evalSnapshot'
import { type View } from '../types'
import { DecisionStatusBadge, StageStateBadge } from './evals/SnapshotBadges'
import { EVAL_SNAPSHOT_PLACEHOLDER } from './inspector/inspectorModel'
import { type OnboardingTemplate } from './onboardingData'

function SnapshotReadinessNotice() {
  const snap = DEFAULT_EVAL_SNAPSHOT
  if (!snap) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-slate-200 uppercase tracking-wide">clearauth-eval Readiness Snapshot</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded-full border border-slate-600/60 bg-slate-900/60 text-slate-300">
            <Clock className="w-3 h-3 text-slate-400" />
            {EVAL_SNAPSHOT_PLACEHOLDER.state} · awaiting eval_snapshot.json
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Stage readiness verdicts (targets.json), E2E flow totals, and held-out one-shot status load from the harness snapshot once exported.
        </p>
      </div>
    )
  }

  const counts = summarizeReadiness(snap.readiness.stages)
  const tracked = snap.readiness.stages.filter(s => s.state !== 'not_built')

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-200 uppercase tracking-wide">clearauth-eval Readiness Snapshot</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <GitCommit className="w-3 h-3" />
            v{snap.schema_version} · {formatShortCommit(snap.as_of_commit)}
          </span>
          <DecisionStatusBadge decision={snap.readiness.decision} />
        </div>
      </div>
      <p className="text-xs font-mono text-slate-300">
        {counts.ready} ready · {counts.notYet} not yet · {counts.noRuns} no runs · {counts.notBuilt} not built
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tracked.map(st => (
          <span key={st.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-700/60 bg-slate-900/50 text-[11px] font-mono text-slate-200">
            <span>{st.id}</span>
            <StageStateBadge state={st.state} />
          </span>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">Held-out wording sets are one-shot with rotation (ADR 0004).</p>
    </div>
  )
}

export function ValidateLaunchStep({
  template, validating, validated, launched, onRunValidation, onLaunch, setView,
}: {
  template: OnboardingTemplate; validating: boolean; validated: boolean; launched: boolean
  onRunValidation: () => void; onLaunch: () => void; setView: (v: View) => void
}) {
  if (!validated) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-400">
          Run the shared eval suite against {template.validation.sampleCases} sample cases through {template.company}&rsquo;s configuration — scored by the <button onClick={() => setView('rubric')} className="text-emerald-400 hover:underline">Eval Rubric</button>.
        </p>
        <button onClick={onRunValidation} disabled={validating} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
          {validating ? 'Running eval suite…' : `Run validation (${template.validation.sampleCases} sample cases)`}
        </button>
      </div>
    )
  }

  if (launched) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Rocket className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="text-lg font-bold text-emerald-400">{template.company} is Live</h2><p className="text-sm text-emerald-300/70">Configured and deployed on the shared platform.</p></div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('platform')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"><Boxes className="w-4 h-4" />View Platform Registry</button>
          <button onClick={() => setView('portfolio')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"><ChevronRight className="w-4 h-4" />Go to Case Queue</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
        <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-emerald-300">Cleared the Launch Gate</h2>
          <p className="text-xs text-emerald-300/70">{template.validation.sampleCases}/{template.validation.sampleCases} sample cases passed every active deterministic &amp; entailment check.</p>
        </div>
      </div>
      <SnapshotReadinessNotice />
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2"><Workflow className="w-4 h-4 text-slate-400" /><span className="text-sm font-medium text-slate-300">Eval Gate · shared rubric</span></div>
          <button onClick={() => setView('rubric')} className="text-xs text-emerald-400 hover:underline whitespace-nowrap">View Eval Rubric →</button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Dimension</th>
              <th className="text-left px-4 py-2.5 font-medium">Method</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
              <th className="text-center px-4 py-2.5 font-medium">Gate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {RUBRIC_DIMENSIONS.map(d => {
              const unbuilt = d.status === 'not_built'
              return (
                <tr key={d.dimension} className="hover:bg-slate-700/20">
                  <td className="px-4 py-2.5 text-slate-300">{d.dimension}</td>
                  <td className="px-4 py-2.5 text-slate-500">{METHOD_LABEL[d.method]}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-slate-400">{thresholdLabel(d.threshold)}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-emerald-300">{unbuilt ? '—' : `${Math.round(Math.min(1, d.threshold + 0.04) * 100)}%`}</td>
                  <td className="px-4 py-2.5 text-center">{unbuilt ? <span className="text-[11px] font-mono text-slate-400">not run (advisory)</span> : <CheckCircle className="w-4 h-4 text-emerald-400 inline" />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Net-New Code', value: '0 lines', sub: `${template.company} uses configuration, not bespoke code.` },
          { label: 'Configuration Split', value: `${template.validation.reusePct}% / ${100 - template.validation.reusePct}%`, sub: `${template.validation.netNew}.` },
          { label: 'Setup Time', value: template.validation.timeEstimate, sub: 'configuration vs. multi-week build (illustrative)' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
            <p className="text-2xl font-bold font-mono text-emerald-300 leading-none">{m.value}</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.sub}</p>
          </div>
        ))}
      </div>
      <button onClick={onLaunch} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
        <Rocket className="w-4 h-4" />Launch {template.company}
      </button>
    </div>
  )
}
