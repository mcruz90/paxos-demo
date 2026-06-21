import { useState } from 'react'
import { Building2, User, Shield, Clock } from 'lucide-react'
import { TENANT } from '../data/scenarios'

export const EVAL_HEADLINE = [
  {
    key: 'coverage',
    label: 'Guideline Coverage',
    score: 94.2,
    desc: 'PA criteria with a supporting clinical guideline or policy citation located',
    color: 'emerald',
  },
  {
    key: 'structure',
    label: 'Letter Structure',
    score: 100,
    desc: 'Generated letters containing all required sections before coordinator review',
    color: 'emerald',
  },
  {
    key: 'safety',
    label: 'Safety Gate (1st pass)',
    score: 100,
    desc: 'Cases cleared the deterministic rule check without triggering a retry',
    color: 'emerald',
  },
  {
    key: 'alignment',
    label: 'Claim-Citation Alignment',
    score: 97.8,
    desc: 'Letter claims independently traceable to a retrieved source document',
    color: 'emerald',
  },
] as const

export const EVAL_BY_CASE = [
  {
    name: 'Case #PH-3102',
    drug: 'Ozempic',
    category: 'Endocrinology',
    rounds: 1,
    coverage: 96,
    structure: 100,
    safety: 100,
    alignment: 98,
  },
  {
    name: 'Case #PH-4201',
    drug: 'Omeprazole Susp.',
    category: 'Gastroenterology',
    rounds: 2,
    coverage: 92,
    structure: 100,
    safety: 100,
    alignment: 97,
  },
]

export function ScorePill({ v }: { v: number }) {
  const color = v === 100 ? 'text-emerald-300 bg-emerald-500/10' : v >= 90 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-300 bg-amber-500/10'
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${color}`}>{v}%</span>
}

export const OUTCOMES_HEADLINE: { key: string; label: string; value: string; unit: string; sub: string; colorClass: string }[] = [
  { key: 'approval', label: 'Auth Approval Rate',    value: '87%', unit: '',           sub: 'Cases approved by payer this period',    colorClass: 'text-emerald-300' },
  { key: 'appeal',   label: 'Appeal Win Rate',        value: '94%', unit: '',           sub: 'Denied cases overturned on resubmission', colorClass: 'text-emerald-300' },
  { key: 'days',     label: 'Avg Days to Decision',   value: '4.2', unit: 'days',       sub: 'Submission to payer response',            colorClass: 'text-sky-300' },
  { key: 'time',     label: 'Avg Coordinator Review', value: '14',  unit: 'min / case', sub: 'vs. ~67 min manual baseline',             colorClass: 'text-violet-300' },
]

export const PAYER_PERF = [
  { payer: 'Cigna',            cases: 4, approvalRate: 92, avgDays: 3.8, trend: '↑', trendColor: 'text-emerald-400' },
  { payer: 'UnitedHealthcare', cases: 3, approvalRate: 83, avgDays: 5.1, trend: '→', trendColor: 'text-slate-400' },
  { payer: 'Aetna CVS Health', cases: 2, approvalRate: 75, avgDays: 6.2, trend: '↓', trendColor: 'text-red-400' },
]

// Outcomes are tracked by drug × INDICATION — the same drug can have multiple
// indications with entirely different criteria and payer posture (e.g. Ozempic
// for T2DM vs. weight management). A single "note" can't represent that, so each
// indication is its own row with a trend, mirroring Payer Performance.
export const DRUG_PERF: { drug: string; indication: string; category: string; cases: number; approvalRate: number | null; trend: string; trendColor: string }[] = [
  { drug: 'Ozempic',          indication: 'Type 2 Diabetes',             category: 'Endocrinology',    cases: 4, approvalRate: 92,   trend: '↑', trendColor: 'text-emerald-400' },
  { drug: 'Ozempic',          indication: 'Weight management',           category: 'Endocrinology',    cases: 3, approvalRate: 78,   trend: '↓', trendColor: 'text-red-400' },
  { drug: 'Omeprazole Susp.', indication: 'Infant GERD',                 category: 'Gastroenterology', cases: 2, approvalRate: 84,   trend: '→', trendColor: 'text-slate-400' },
  { drug: 'Ocaliva',          indication: 'Primary Biliary Cholangitis', category: 'Hepatology',       cases: 1, approvalRate: null, trend: '→', trendColor: 'text-slate-400' },
]

export const ACTIVE_PIPELINE = [
  { name: 'Case #PH-3102', drug: 'Ozempic',          tier: 'Routine',   tierColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', status: 'Ready for Review',        statusColor: 'text-emerald-300' },
  { name: 'Case #PH-4201', drug: 'Omeprazole Susp.', tier: 'Complex',   tierColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       status: 'Awaiting Payer Response', statusColor: 'text-amber-300' },
  { name: 'Case #PH-2847', drug: 'Ocaliva',          tier: 'Exception', tierColor: 'text-red-400 bg-red-500/10 border-red-500/20',             status: 'Action Required',         statusColor: 'text-red-300' },
]

export function EvalDashboard() {
  const [evalView, setEvalView] = useState<'coordinator' | 'platform'>('coordinator')

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {evalView === 'coordinator' ? 'Case Outcomes' : 'Pipeline Quality Report'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {evalView === 'coordinator'
              ? `Authorization performance · ${TENANT.name} · Last 90 days`
              : 'Internal quality metrics · Demo benchmark · representative subset'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
          <button
            onClick={() => setEvalView('coordinator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${evalView === 'coordinator' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <User className="w-3.5 h-3.5" />
            PA Coordinator
          </button>
          <button
            onClick={() => setEvalView('platform')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${evalView === 'platform' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Paxos Platform
          </button>
        </div>
      </div>

      {evalView === 'coordinator' ? (
        <div className="px-8 py-6 space-y-8 max-w-6xl">

          {/* Featured KPI — Time to Therapy (the client's #1 outcome) */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-5 flex items-start justify-between gap-6 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-medium text-emerald-300">Time to Therapy</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 uppercase tracking-wide">Client’s #1 outcome</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold font-mono text-emerald-300 leading-none">2.1</span>
                <span className="text-sm text-slate-400">days · median</span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md">
                Order received → therapy authorized, for approved initial PAs on the electronic (Da Vinci PAS) lane. Every day saved is a day sooner the patient starts treatment.
              </p>
            </div>
            <div className="text-xs text-slate-500 leading-relaxed max-w-xs space-y-1.5 shrink-0">
              <p>Initial PAs clear fastest — clean cases (e.g. <span className="text-slate-300">PH-3098</span>) authorize in ~2 days. The blended submission→decision time across appeals and complex cases is <span className="text-slate-300">4.2 days</span> (below).</p>
              <p className="text-slate-600">vs. ~9–14 days typical manual PA turnaround · illustrative</p>
            </div>
          </div>

          {/* Headline outcomes */}
          <div className="grid grid-cols-2 gap-4">
            {OUTCOMES_HEADLINE.map(m => (
              <div key={m.key} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-3xl font-bold font-mono leading-none ${m.colorClass}`}>{m.value}</span>
                  {m.unit ? <span className="text-sm text-slate-500">{m.unit}</span> : null}
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Active Pipeline */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Active Pipeline</h2>
            <p className="text-xs text-slate-500 mb-3">Cases currently in-flight — open the Case Queue to act</p>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              {ACTIVE_PIPELINE.map((c, i) => (
                <div key={c.name} className={`flex items-center gap-4 px-4 py-3 ${i < ACTIVE_PIPELINE.length - 1 ? 'border-b border-slate-700/40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.drug}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${c.tierColor}`}>{c.tier}</span>
                  <span className={`text-xs font-medium whitespace-nowrap ${c.statusColor}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payer Performance */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Payer Performance</h2>
            <p className="text-xs text-slate-500 mb-3">Approval rate and turnaround by insurer · Last 90 days</p>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Payer</th>
                    <th className="text-center px-4 py-3 font-medium">Cases</th>
                    <th className="text-center px-4 py-3 font-medium">Approval Rate</th>
                    <th className="text-center px-4 py-3 font-medium">Avg Days</th>
                    <th className="text-center px-4 py-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {PAYER_PERF.map(p => (
                    <tr key={p.payer} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{p.payer}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{p.cases}</td>
                      <td className="px-4 py-3 text-center"><ScorePill v={p.approvalRate} /></td>
                      <td className="px-4 py-3 text-center text-slate-300">{p.avgDays}d</td>
                      <td className={`px-4 py-3 text-center text-base font-semibold ${p.trendColor}`}>{p.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drug Coverage */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Coverage by Drug &amp; Indication</h2>
            <p className="text-xs text-slate-500 mb-3">Authorization outcomes per drug × indication · Last 90 days · trend vs. prior period</p>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Drug</th>
                    <th className="text-left px-4 py-3 font-medium">Indication</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-center px-4 py-3 font-medium">Cases</th>
                    <th className="text-center px-4 py-3 font-medium">Approval Rate</th>
                    <th className="text-center px-4 py-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {DRUG_PERF.map(d => (
                    <tr key={`${d.drug}·${d.indication}`} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200">{d.drug}</td>
                      <td className="px-4 py-3 text-slate-300">{d.indication}</td>
                      <td className="px-4 py-3 text-slate-400">{d.category}</td>
                      <td className="px-4 py-3 text-center text-slate-300">{d.cases}</td>
                      <td className="px-4 py-3 text-center">
                        {d.approvalRate !== null ? <ScorePill v={d.approvalRate} /> : <span className="text-slate-500">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-center text-base font-semibold ${d.trendColor}`}>{d.trend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-slate-600 pb-4">
            Figures reflect this demo benchmark. In production, outcomes update continuously as payer decisions are received.
          </p>

        </div>
      ) : (
        <div className="px-8 py-6 space-y-8 max-w-6xl">

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-xs text-slate-400">Internal quality metrics — visible to Paxos platform team only, not surfaced to client accounts.</span>
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-2 gap-4">
            {EVAL_HEADLINE.map(m => (
              <div key={m.key} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold text-white leading-snug">{m.label}</p>
                  <span className="text-2xl font-bold font-mono text-emerald-300 shrink-0 leading-none">
                    {m.score}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-700">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${m.score}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Case routing distribution */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Case Routing Distribution</h2>
            <p className="text-xs text-slate-500 mb-4">How the pipeline classified 12 benchmark cases across review tiers</p>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[
                { tier: 'Routine Review',  count: 7,  pct: 58, color: 'emerald', note: '~3 min coordinator review' },
                { tier: 'Complex Review',  count: 3,  pct: 25, color: 'amber',   note: '~10 min coordinator review' },
                { tier: 'Exception',       count: 2,  pct: 17, color: 'red',     note: 'Investigation required' },
              ].map(({ tier, count, pct, color, note }) => (
                <div key={tier} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-bold font-mono text-${color}-300`}>{count}</span>
                    <span className={`text-xs font-medium text-${color}-400`}>{pct}%</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-700">
                    <div className={`h-1 rounded-full bg-${color}-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">{tier}</p>
                  <p className="text-xs text-slate-500">{note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mb-1">
              83% of cases resolved with minimal coordinator input (≤10 min). The remaining 17% surfaced genuinely unresolvable gaps — the cases that actually require human expertise.
            </p>
          </div>

          {/* Per-case breakdown */}
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
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.rounds === 2 ? 'text-violet-300 bg-violet-500/10' : 'text-slate-400 bg-slate-700/40'}`}>
                          Round {c.rounds}
                        </span>
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

          {/* Metric definitions */}
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Metric Definitions</h2>
            <div className="space-y-2">
              {[
                {
                  name: 'Guideline Coverage',
                  method: 'An LLM judge scores each letter against authored criteria — every PA criterion in the policy is addressed and backed by a cited source. Calibrated against a clinician panel (see Eval Rubric).',
                },
                {
                  name: 'Letter Structure',
                  method: 'A deterministic parse verifies the letter contains the required sections: opening, clinical evidence block, authorization request, and closing. No AI judgment involved.',
                },
                {
                  name: 'Safety Gate (1st pass)',
                  method: 'The gatekeeper node applies a fixed rule set — drug name present, diagnosis present, denial reason addressed, minimum length, no refusal phrases. Score = cases passing all rules on the first attempt.',
                },
                {
                  name: 'Claim-Citation Alignment',
                  method: 'Each factual claim in the letter is matched against the set of retrieved citations. A claim is aligned if the cited source text contains the supporting evidence. Unmatched claims are flagged for coordinator review.',
                },
              ].map(m => (
                <div key={m.name} className="flex gap-4 px-4 py-3 bg-slate-800/30 rounded-lg border border-slate-700/40">
                  <p className="text-xs font-semibold text-slate-300 w-44 shrink-0 pt-0.5">{m.name}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{m.method}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600 pb-4">
            Structure and safety metrics are computed deterministically; the subjective dimensions (coverage, argument, tone, safety language) are scored by an LLM judge calibrated against a clinician panel — see the Eval Rubric. Scores reflect this demo benchmark; production figures update continuously as cases are processed.
          </p>

        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Platformization — Connector catalog, onboarding templates, registry
// ---------------------------------------------------------------------------
