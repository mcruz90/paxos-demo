import { Clock, GitCompare } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  NOT_IN_SNAPSHOT,
  formatClearauthDecisionLabel,
  formatExactPValue,
  formatWilsonRange,
} from '../../data/evalSnapshot'
import type { Comparison, EvalSnapshot } from '../../generated/evalSnapshotTypes'
import { DecisionStatusBadge, SectionStateBadge } from './SnapshotBadges'

function MeasuredComparisonView({ cmp }: { cmp: Comparison }) {
  const deltaRange = cmp.delta !== undefined && cmp.delta_low !== undefined && cmp.delta_high !== undefined
    ? `${(cmp.delta * 100).toFixed(2)} pts [${(cmp.delta_low * 100).toFixed(2)}, ${(cmp.delta_high * 100).toFixed(2)}]`
    : '—'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        {[{ tag: 'Run A', r: cmp.a, ok: cmp.a_correct, range: cmp.a_range }, { tag: 'Run B', r: cmp.b, ok: cmp.b_correct, range: cmp.b_range }].map(side => (
          <div key={side.tag} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-200">{side.tag} · {side.r.prompt_version}</span>
              <span className="font-mono text-emerald-300">{side.ok} / {cmp.gaps}</span>
            </div>
            <p className="font-mono text-[11px] text-slate-400">{side.r.run_id} · req {side.r.request_version}</p>
            <p className="font-mono text-[11px] text-slate-400">95% CI: {formatWilsonRange(side.range)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: 'Fixed', value: String(cmp.fixed), cls: 'text-emerald-300' },
          { label: 'Broke', value: String(cmp.broke), cls: cmp.broke === 0 ? 'text-emerald-300' : 'text-amber-300' },
          { label: 'New Silent Errors', value: String(cmp.new_silent_errors), cls: cmp.new_silent_errors === 0 ? 'text-emerald-300' : 'text-red-300' },
          { label: 'Exact p-value', value: formatExactPValue(cmp.p_value), cls: 'text-sky-300' },
          { label: 'Decision', value: cmp.decision, cls: 'text-white' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-2">
            <p className="text-[11px] text-slate-400">{k.label}</p>
            <p className={`text-sm font-bold font-mono ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] font-mono text-slate-400">Delta: {deltaRange} · left out: {cmp.left_out}</p>
    </div>
  )
}

function PairedPromptsCard({ paired }: { paired: EvalSnapshot['paired_prompts'] }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">4. Paired Prompt Comparison · paired.py</h2>
        </div>
        <SectionStateBadge state={paired.state} />
      </div>

      {paired.state === 'measured' && paired.comparison ? (
        <MeasuredComparisonView cmp={paired.comparison} />
      ) : (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 space-y-1">
          <p className="text-xs text-slate-200">{paired.why ?? 'No paired prompt comparison run selected.'}</p>
          <p className="text-[11px] font-mono text-slate-400">
            python -m console.snapshot_json --out eval_snapshot.json --compare RUN_A RUN_B
          </p>
        </div>
      )}

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/30 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-400 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2 font-medium">Stored AI-Fallback Run</th>
              <th className="text-left px-3 py-2 font-medium">Prompt</th>
              <th className="text-left px-3 py-2 font-medium">Request</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40 font-mono text-[11px]">
            {paired.runs.map(r => (
              <tr key={r.run_id} className="hover:bg-slate-700/20">
                <td className="px-3 py-1.5 text-slate-200">{r.run_id}</td>
                <td className="px-3 py-1.5 text-violet-300">{r.prompt_version}</td>
                <td className="px-3 py-1.5 text-slate-400">{r.request_version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ClocksRegistryCard({ clocks }: { clocks: EvalSnapshot['clocks'] }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 space-y-3.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">5. Regulatory Clock Registry · clock_registry.json</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SectionStateBadge state={clocks.state} />
          <DecisionStatusBadge decision={clocks.decision} />
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        Source-verified rules from <span className="font-mono text-slate-300">clock_registry.json</span> ({formatClearauthDecisionLabel(clocks.decision)}).
      </p>

      <div className="space-y-2">
        {clocks.clocks.map(c => (
          <div key={c.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-emerald-300">{c.duration} {c.unit}</span>
              <span className="font-mono text-[11px] text-slate-300">{c.program} · {c.request_type} · {c.urgency}</span>
            </div>
            <p className="text-xs text-slate-300">
              Start: <span className="font-mono text-slate-200">{c.start_event}</span> · Citation: <span className="font-mono text-sky-300">{c.citation}</span>
            </p>
            <p className="text-[11px] font-mono text-slate-400">Verified on: {c.verified_on.join(', ')}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Not Applicable ({clocks.not_applicable.length})
        </p>
        {clocks.not_applicable.map(na => (
          <div key={na.id} className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-semibold text-amber-300">{na.rule}</span>
              <span className="text-[11px] font-mono text-slate-400">excludes {na.subject}</span>
            </div>
            <p className="text-xs text-slate-400">{na.citation}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MissingSectionCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 flex items-center justify-between gap-2 flex-wrap">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <span className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</span>
    </div>
  )
}

export function PairedPromptsAndClocksCard({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {snapshot?.paired_prompts
        ? <PairedPromptsCard paired={snapshot.paired_prompts} />
        : <MissingSectionCard title="4. Paired Prompt Comparison · paired.py" />}
      {snapshot?.clocks
        ? <ClocksRegistryCard clocks={snapshot.clocks} />
        : <MissingSectionCard title="5. Regulatory Clock Registry · clock_registry.json" />}
    </div>
  )
}
