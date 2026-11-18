import { Shield } from 'lucide-react'
import { EVAL_BY_CASE, EVAL_HEADLINE, ScorePill } from './evalDashboardData'

function RoutingDistribution() {
  const rows = [
    { tier: 'Routine Review', count: 7, pct: 58, textCls: 'text-emerald-300', subCls: 'text-emerald-400', barCls: 'bg-emerald-500', note: '~3 min coordinator review' },
    { tier: 'Complex Review', count: 3, pct: 25, textCls: 'text-amber-300', subCls: 'text-amber-400', barCls: 'bg-amber-500', note: '~10 min coordinator review' },
    { tier: 'Exception', count: 2, pct: 17, textCls: 'text-red-300', subCls: 'text-red-400', barCls: 'bg-red-500', note: 'Investigation required' },
  ]
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 mb-1">Case Routing Distribution</h2>
      <p className="text-xs text-slate-500 mb-4">How the pipeline classified 12 benchmark cases across review tiers</p>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {rows.map(r => (
          <div key={r.tier} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono ${r.textCls}`}>{r.count}</span>
              <span className={`text-xs font-medium ${r.subCls}`}>{r.pct}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-slate-700">
              <div className={`h-1 rounded-full ${r.barCls}`} style={{ width: `${r.pct}%` }} />
            </div>
            <p className="text-xs font-semibold text-slate-300">{r.tier}</p>
            <p className="text-xs text-slate-500">{r.note}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 mb-1">
        83% of cases resolved with minimal coordinator input (≤10 min). The remaining 17% surfaced genuinely unresolvable gaps.
      </p>
    </div>
  )
}

function MetricDefinitions() {
  const defs = [
    { name: 'Guideline Coverage', method: 'An LLM judge scores each letter against authored criteria — every PA criterion in the policy is addressed and backed by a cited source.' },
    { name: 'Letter Structure', method: 'A deterministic parse verifies the letter contains the required sections: opening, clinical evidence block, authorization request, and closing.' },
    { name: 'Safety Gate (1st pass)', method: 'The gatekeeper node applies a fixed rule set — drug name present, diagnosis present, denial reason addressed, minimum length, no refusal phrases.' },
    { name: 'Claim-Citation Alignment', method: 'Each factual claim in the letter is matched against the set of retrieved citations; unmatched claims are flagged for review.' },
  ]
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 mb-3">Metric Definitions</h2>
      <div className="space-y-2">
        {defs.map(m => (
          <div key={m.name} className="flex gap-4 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/40">
            <p className="text-xs font-semibold text-slate-300 w-44 shrink-0 pt-0.5">{m.name}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{m.method}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function EvalPlatformQualitySection() {
  return (
    <div className="px-8 py-6 space-y-8">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
        <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-400">Internal quality metrics — visible to ClearAuth platform team only, not surfaced to client accounts.</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {EVAL_HEADLINE.map(m => (
          <div key={m.key} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold text-white leading-snug">{m.label}</p>
              <span className="text-2xl font-bold font-mono text-emerald-300 shrink-0 leading-none">{m.score}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-700">
              <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${m.score}%` }} />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
          </div>
        ))}
      </div>
      <RoutingDistribution />
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">By Case</h2>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Case</th>
                <th className="text-left px-4 py-3 font-medium">Drug</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-center px-4 py-3 font-medium">Rounds</th>
                <th className="text-center px-4 py-3 font-medium">Coverage</th>
                <th className="text-center px-4 py-3 font-medium">Structure</th>
                <th className="text-center px-4 py-3 font-medium">Safety Gate</th>
                <th className="text-center px-4 py-3 font-medium">Alignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {EVAL_BY_CASE.map(c => (
                <tr key={c.name} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.drug}</td>
                  <td className="px-4 py-3 text-slate-400">{c.category}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.rounds === 2 ? 'text-violet-300 bg-violet-500/10' : 'text-slate-400 bg-slate-700/40'}`}>Round {c.rounds}</span>
                  </td>
                  <td className="px-4 py-3 text-center"><ScorePill v={c.coverage} /></td>
                  <td className="px-4 py-3 text-center"><ScorePill v={c.structure} /></td>
                  <td className="px-4 py-3 text-center"><ScorePill v={c.safety} /></td>
                  <td className="px-4 py-3 text-center"><ScorePill v={c.alignment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <MetricDefinitions />
      <p className="text-xs text-slate-600 pb-4">
        Structure and safety metrics are computed deterministically; subjective dimensions are scored by an LLM judge calibrated against a clinician panel.
      </p>
    </div>
  )
}
