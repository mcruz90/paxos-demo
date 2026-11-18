import { useState } from 'react'
import { Building2, Clock, User } from 'lucide-react'
import { CASE_STATUS_LABEL, PIPELINE_CASE_IDS, TENANT, getCaseTier, initialClients } from '../data/scenarios'
import { DRUG_PERF, OUTCOMES_HEADLINE, PAYER_PERF, ScorePill } from './evalDashboardData'
import { EvalPlatformQualitySection } from './EvalPlatformQualitySection'
import { TierBadge } from './ui'

export { DRUG_PERF, EVAL_BY_CASE, EVAL_HEADLINE, OUTCOMES_HEADLINE, PAYER_PERF, ScorePill } from './evalDashboardData'

function CoordinatorOutcomesSection() {
  return (
    <div className="px-8 py-6 space-y-8">
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
            Order received → therapy authorized, for approved initial PAs on the electronic (Da Vinci PAS) lane.
          </p>
        </div>
        <div className="text-xs text-slate-500 leading-relaxed max-w-xs space-y-1.5 shrink-0">
          <p>Initial PAs clear fastest (<span className="text-slate-300">PH-3098</span> ~2 days); blended turnaround is <span className="text-slate-300">4.2 days</span>.</p>
          <p className="text-slate-600">vs. ~9–14 days typical manual PA turnaround · illustrative</p>
        </div>
      </div>

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

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Active Pipeline</h2>
        <p className="text-xs text-slate-500 mb-3">Cases currently in-flight — open the Case Queue to act</p>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          {PIPELINE_CASE_IDS.map((id, i) => {
            const c = initialClients.find(cl => cl.name.endsWith(id))
            if (!c) return null
            const tier = getCaseTier(c)
            return (
              <div key={c.name} className={`flex items-center gap-4 px-4 py-3 ${i < PIPELINE_CASE_IDS.length - 1 ? 'border-b border-slate-700/40' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.drug}</p>
                </div>
                <TierBadge tier={tier} />
                <span className={`text-xs font-medium whitespace-nowrap ${tier === 'routine' ? 'text-emerald-300' : 'text-amber-300'}`}>{CASE_STATUS_LABEL[c.status]}</span>
              </div>
            )
          })}
        </div>
      </div>

      <OutcomesTables />
      <p className="text-xs text-slate-600 pb-4">Figures reflect this demo benchmark. In production, outcomes update as payer decisions arrive.</p>
    </div>
  )
}

function OutcomesTables() {
  return (
    <>
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
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-1">Coverage by Drug &amp; Indication</h2>
        <p className="text-xs text-slate-500 mb-3">Authorization outcomes per drug × indication · Last 90 days</p>
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
                  <td className="px-4 py-3 text-center">{d.approvalRate !== null ? <ScorePill v={d.approvalRate} /> : <span className="text-slate-500">—</span>}</td>
                  <td className={`px-4 py-3 text-center text-base font-semibold ${d.trendColor}`}>{d.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function EvalDashboard({ mode = 'coordinator_only' }: { mode?: 'coordinator_only' | 'platform_only' | 'both' }) {
  const [selectedView, setSelectedView] = useState<'coordinator' | 'platform'>(mode === 'platform_only' ? 'platform' : 'coordinator')
  const evalView = mode === 'coordinator_only' ? 'coordinator' : mode === 'platform_only' ? 'platform' : selectedView

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">
            {evalView === 'coordinator' ? 'Case Outcomes' : 'Pipeline Quality Report'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {evalView === 'coordinator' ? `Authorization performance · ${TENANT.name} · Last 90 days` : 'Internal quality metrics · Demo benchmark · representative subset'}
          </p>
        </div>
        {mode === 'both' && (
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
            <button type="button" onClick={() => setSelectedView('coordinator')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${evalView === 'coordinator' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              <User className="w-3.5 h-3.5" /> PA Coordinator
            </button>
            <button type="button" onClick={() => setSelectedView('platform')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${evalView === 'platform' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
              <Building2 className="w-3.5 h-3.5" /> ClearAuth Platform
            </button>
          </div>
        )}
      </div>
      {evalView === 'coordinator' ? <CoordinatorOutcomesSection /> : <EvalPlatformQualitySection />}
    </div>
  )
}
