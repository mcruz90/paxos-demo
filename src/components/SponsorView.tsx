import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { computeSponsorFunnel, SPONSOR_BRANDS, type SponsorBrand } from './sponsorData'
import { InfoHint } from './ui'

export { SPONSOR_BRANDS, type SponsorBrand } from './sponsorData'

export function TrendChip({ value, goodWhenNegative }: { value: number; goodWhenNegative?: boolean }) {
  const good = goodWhenNegative ? value < 0 : value > 0
  const sign = value > 0 ? '+' : ''
  return <span className={`text-xs font-medium ${good ? 'text-emerald-400' : 'text-slate-500'}`}>{sign}{value} {goodWhenNegative ? 'days' : 'pts'} QoQ</span>
}

function SponsorKpiStrip({ brand }: { brand: SponsorBrand }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
        <p className="text-xs text-slate-500 mb-1">Net Approval Rate</p>
        <p className="text-2xl font-bold font-mono text-emerald-400">{brand.approvalRate}%</p>
        <TrendChip value={brand.approvalTrend} />
      </div>
      <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
          Median Time to Therapy <InfoHint text="Median calendar days from initial denial to approved authorization across all live sites." wide />
        </p>
        <p className="text-2xl font-bold font-mono text-white">{brand.medianDaysToTherapy}<span className="text-sm font-normal text-slate-500"> days</span></p>
        <TrendChip value={brand.daysTrend} goodWhenNegative />
      </div>
      <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
        <p className="text-xs text-slate-500 mb-1">Sites Live on ClearAuth</p>
        <p className="text-2xl font-bold font-mono text-white">{brand.sitesLive}<span className="text-sm font-normal text-slate-500"> / 42</span></p>
        <span className="text-xs text-slate-500">deployments running product</span>
      </div>
      <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
        <p className="text-xs text-slate-500 mb-1">Cases This Quarter</p>
        <p className="text-2xl font-bold font-mono text-white">{brand.casesQuarter.toLocaleString()}</p>
        <span className="text-xs text-slate-500">authorizations processed</span>
      </div>
    </div>
  )
}

function AuthorizationFunnelCard({ brand }: { brand: SponsorBrand }) {
  const f = computeSponsorFunnel(brand)
  const stages = [
    { label: 'Initial PA Submitted', pct: 100, detail: `${f.initialSubmitted.toLocaleString()} cases (quarter)`, barCls: 'bg-slate-500' },
    { label: '1st-Pass PAS / EDI Approved', pct: f.firstPassApprovedPct, detail: `${f.firstPassApprovedPct}% cleared on initial submission`, barCls: 'bg-sky-500' },
    { label: 'Routed to Citation-Grounded Appeal', pct: f.appealedPct, detail: `${f.postAppealApprovedPct}% of appealed denials overturned`, barCls: 'bg-violet-500' },
    { label: 'Net Therapy Access Achieved', pct: f.netAccessPct, detail: `+${f.netAccessPct - f.firstPassApprovedPct} pts recovered via ClearAuth appeal`, barCls: 'bg-emerald-500' },
  ]
  return (
    <div className="rounded-xl p-5 bg-slate-800/40 border border-slate-700/60 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white">Authorization Conversion Funnel · First-Pass vs. Post-Appeal Recovery</h2>
          <p className="text-xs text-slate-500 mt-0.5">How initial electronic submissions and citation-grounded appeals combine to lift net therapy initiation</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
          k-anonymity ≥ {f.kAnonymityFloor} · {f.phiIdentifiersCount} PHI identifiers
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {stages.map(s => (
          <div key={s.label} className="rounded-lg bg-slate-900/50 border border-slate-700/50 p-3 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-slate-300 leading-snug">{s.label}</span>
              <span className="text-lg font-bold font-mono text-white shrink-0">{s.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className={`h-full rounded-full ${s.barCls}`} style={{ width: `${s.pct}%` }} /></div>
            <p className="text-[11px] text-slate-500">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PolicyFrictionMatrix({ brand }: { brand: SponsorBrand }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl p-5 bg-slate-800/40 border border-slate-700/60">
        <h2 className="text-sm font-semibold text-white mb-1">Payer Policy Friction &amp; Documentation Gaps</h2>
        <p className="text-xs text-slate-500 mb-4">Aggregate criteria driving denials — pinpoints where prescriber education removes bottlenecks.</p>
        <div className="space-y-3">
          {brand.denialReasons.map(d => (
            <div key={d.reason}>
              <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-200">{d.reason}</span><span className="text-xs font-mono text-slate-400">{d.pct}%</span></div>
              <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden mb-1"><div className="h-full rounded-full bg-amber-500/80" style={{ width: `${d.pct}%` }} /></div>
              <p className="text-[11px] text-slate-500">{d.policyGapNote}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-5 bg-slate-800/40 border border-slate-700/60">
        <h2 className="text-sm font-semibold text-white mb-1">Net Approval Rate by Payer</h2>
        <p className="text-xs text-slate-500 mb-4">Where formulary coverage is strong vs. where non-preferred step barriers concentrate.</p>
        <div className="space-y-3">
          {brand.byPayer.map(p => (
            <div key={p.payer}>
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-slate-300">{p.payer}</span><span className="text-xs font-mono text-slate-400">{p.rate}%</span></div>
              <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden"><div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${p.rate}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SponsorView() {
  const [brandId, setBrandId] = useState(SPONSOR_BRANDS[0].id)
  const brand = SPONSOR_BRANDS.find(b => b.id === brandId)!

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold font-display text-white">Coverage Insights</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
            <ShieldCheck className="w-3 h-3" />De-identified · 0 PHI identifiers
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">
          Aggregate authorization outcomes across all 4 specialty brands running ClearAuth (k-anonymity ≥ 10; read-only market access plane).
        </p>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {SPONSOR_BRANDS.map(b => {
            const active = b.id === brandId
            return (
              <button
                key={b.id} onClick={() => setBrandId(b.id)}
                className={`flex flex-col items-start px-3.5 py-2 rounded-lg border text-left transition-colors ${
                  active ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-sm font-medium">{b.manufacturer}</span>
                <span className={`text-xs ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{b.drug}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-8 py-6 space-y-6">
        <SponsorKpiStrip brand={brand} />
        <AuthorizationFunnelCard brand={brand} />
        <PolicyFrictionMatrix brand={brand} />
      </div>
    </div>
  )
}
