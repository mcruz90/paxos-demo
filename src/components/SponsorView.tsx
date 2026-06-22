import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { InfoHint } from './ui'

export interface SponsorBrand {
  id: string
  manufacturer: string
  drug: string
  approvalRate: number
  approvalTrend: number      // points vs. prior quarter
  medianDaysToTherapy: number
  daysTrend: number
  sitesLive: number
  casesQuarter: number
  denialReasons: { reason: string; pct: number }[]
  byPayer: { payer: string; rate: number }[]
}

export const SPONSOR_BRANDS: SponsorBrand[] = [
  {
    id: 'intercept-ocaliva',
    manufacturer: 'Intercept Pharmaceuticals',
    drug: 'Ocaliva (obeticholic acid)',
    approvalRate: 71, approvalTrend: 6,
    medianDaysToTherapy: 18, daysTrend: -4,
    sitesLive: 9, casesQuarter: 247,
    denialReasons: [
      { reason: 'Disease-severity documentation incomplete', pct: 38 },
      { reason: 'Inadequate ursodiol trial documented',      pct: 27 },
      { reason: 'Specialist requirement not met',            pct: 19 },
      { reason: 'Other / administrative',                    pct: 16 },
    ],
    byPayer: [
      { payer: 'Aetna CVS Health',    rate: 68 },
      { payer: 'UnitedHealthcare',    rate: 74 },
      { payer: 'Cigna',               rate: 70 },
      { payer: 'BCBS (multi-state)',  rate: 73 },
    ],
  },
  {
    id: 'novo-ozempic',
    manufacturer: 'Novo Nordisk',
    drug: 'Ozempic (semaglutide)',
    approvalRate: 83, approvalTrend: 3,
    medianDaysToTherapy: 11, daysTrend: -2,
    sitesLive: 22, casesQuarter: 1840,
    denialReasons: [
      { reason: 'Step therapy — metformin trial insufficient', pct: 44 },
      { reason: 'HbA1c threshold not documented',              pct: 22 },
      { reason: 'Quantity / dose limit',                       pct: 18 },
      { reason: 'Other / administrative',                      pct: 16 },
    ],
    byPayer: [
      { payer: 'Cigna',            rate: 81 },
      { payer: 'Aetna CVS Health', rate: 79 },
      { payer: 'UnitedHealthcare', rate: 85 },
      { payer: 'Humana',           rate: 86 },
    ],
  },
]

export function TrendChip({ value, goodWhenNegative }: { value: number; goodWhenNegative?: boolean }) {
  const good = goodWhenNegative ? value < 0 : value > 0
  const sign = value > 0 ? '+' : ''
  return (
    <span className={`text-xs font-medium ${good ? 'text-emerald-400' : 'text-slate-500'}`}>
      {sign}{value} {goodWhenNegative ? 'days' : 'pts'} QoQ
    </span>
  )
}

export function SponsorView() {
  const [brandId, setBrandId] = useState(SPONSOR_BRANDS[0].id)
  const brand = SPONSOR_BRANDS.find(b => b.id === brandId)!

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-white">Coverage Insights</h1>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
            title="Sponsor sees aggregate outcomes only — never patient records or letters. PHI does not cross this boundary."
          >
            <ShieldCheck className="w-3 h-3" />
            De-identified · no PHI
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">
          Aggregate authorization outcomes for your product across every site running ClearAuth. Read-only — manufacturers fund the hubs that operate cases; they don’t work the queue.
        </p>
        {/* Brand selector */}
        <div className="flex items-center gap-2 mt-4">
          {SPONSOR_BRANDS.map(b => (
            <button
              key={b.id}
              onClick={() => setBrandId(b.id)}
              className={`flex flex-col items-start px-3.5 py-2 rounded-lg border text-left transition-colors ${
                b.id === brandId
                  ? 'bg-slate-700/70 border-slate-600 text-white'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-sm font-medium">{b.manufacturer}</span>
              <span className="text-xs text-slate-500">{b.drug}</span>
            </button>
          ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="px-8 pt-6 grid grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
          <p className="text-xs text-slate-500 mb-1">Approval rate</p>
          <p className="text-2xl font-bold text-emerald-400">{brand.approvalRate}%</p>
          <TrendChip value={brand.approvalTrend} />
        </div>
        <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            Median time to therapy
            <InfoHint text="Median calendar days from initial denial to an approved authorization, across all sites." wide />
          </p>
          <p className="text-2xl font-bold text-white">{brand.medianDaysToTherapy}<span className="text-base font-normal text-slate-500"> days</span></p>
          <TrendChip value={brand.daysTrend} goodWhenNegative />
        </div>
        <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
            Sites live on ClearAuth
            <InfoHint text="Of the 42 client deployments on ClearAuth, the number running this product's program. One drug runs at a subset of all deployments." wide />
          </p>
          <p className="text-2xl font-bold text-white">{brand.sitesLive}<span className="text-base font-normal text-slate-500"> / 42</span></p>
          <span className="text-xs text-slate-500">deployments running this product</span>
        </div>
        <div className="rounded-xl p-4 bg-slate-800/40 border border-slate-700/60">
          <p className="text-xs text-slate-500 mb-1">Cases this quarter</p>
          <p className="text-2xl font-bold text-white">{brand.casesQuarter.toLocaleString()}</p>
          <span className="text-xs text-slate-500">authorizations processed</span>
        </div>
      </div>

      {/* Denial-reason taxonomy + by-payer */}
      <div className="px-8 py-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl p-5 bg-slate-800/40 border border-slate-700/60">
          <h2 className="text-sm font-semibold text-white mb-1">Denial-reason taxonomy</h2>
          <p className="text-xs text-slate-500 mb-4">Why payers initially denied — where to focus documentation guidance for prescribers.</p>
          <div className="space-y-3">
            {brand.denialReasons.map(d => (
              <div key={d.reason}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300">{d.reason}</span>
                  <span className="text-xs font-mono text-slate-400">{d.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className="h-full rounded-full bg-amber-500/70" style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl p-5 bg-slate-800/40 border border-slate-700/60">
          <h2 className="text-sm font-semibold text-white mb-1">Approval rate by payer</h2>
          <p className="text-xs text-slate-500 mb-4">Where coverage is strong vs. where policy friction concentrates.</p>
          <div className="space-y-3">
            {brand.byPayer.map(p => (
              <div key={p.payer}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300">{p.payer}</span>
                  <span className="text-xs font-mono text-slate-400">{p.rate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${p.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View 1 — Client Portfolio
// ---------------------------------------------------------------------------
