import { useState } from 'react'
import { ArrowRight, Building2, CheckCircle, History, Info, TrendingUp } from 'lucide-react'
import { initialClients, scenarios, TENANT } from '../data/scenarios'
import { type CaseStatus } from '../types'
import { computePolicyProjection, previewQueueUnderPolicy, type PolicyQueuePreviewRow } from './automationPolicy'
import { CapabilityChip } from './live/CapabilityChip'
import { resolveRegulatoryClock } from './portfolio/regulatoryClocks'
import { ReviewPolicyControl } from './ReviewPolicyControl'
import { IllustrativeTag } from './ui'

const CHANGE_LOG = [
  { date: 'Jun 9, 2026', who: 'M. Torres', change: 'Sample rate: 1 in 10 → 1 in 5', reason: 'Q2 audit found two routine cases with unsupported doses' },
  { date: 'May 14, 2026', who: 'M. Torres', change: 'Auto-assemble enabled for Routine', reason: 'Pilot complete — 98.2% accuracy over 30-day window' },
  { date: 'Apr 1, 2026', who: 'ClearAuth', change: 'Policy initialized at onboarding defaults', reason: '' },
]

const TONE_CLS: Record<PolicyQueuePreviewRow['badgeTone'], string> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  rose: 'text-red-300 bg-red-500/10 border-red-500/25',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/25',
}

function FixtureQueueRoutingPreview({
  rows, onOpenCase,
}: {
  rows: PolicyQueuePreviewRow[]; onOpenCase?: (scenarioId: string, status: CaseStatus) => void
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/60 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">Fixture Workqueue Routing Preview (Demo Cases · {rows.length})</h3>
          <p className="text-xs text-slate-500 mt-0.5">Illustrative routing preview — recomputed locally from your policy toggle &amp; sampling rate</p>
        </div>
      </div>
      <div className="divide-y divide-slate-700/40">
        {rows.map(row => {
          const client = initialClients.find(c => c.id === row.clientId)!
          const clock = resolveRegulatoryClock(client, scenarios[row.scenarioId])
          return (
            <div key={row.clientId} className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-800/40 transition-colors">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200">{row.patientName} <span className="font-mono text-slate-500 font-normal">· {client.name} · {row.drug}</span></p>
                <p className="text-[11px] text-slate-500">{clock.authority} · {clock.windowLabel}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${TONE_CLS[row.badgeTone]}`}>{row.dispositionLabel}</span>
                {onOpenCase && (
                  <button
                    type="button" onClick={() => onOpenCase(row.scenarioId, row.status)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline px-1.5 py-1"
                  >
                    Open Chart <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PolicyRightRail({ projection }: { projection: ReturnType<typeof computePolicyProjection> }) {
  const stats = [
    { label: 'Auto-assembled volume', value: `≈ ${projection.autoAssembledPct}%`, note: 'illustrative (assumes 55% routine mix)', color: 'text-emerald-300' },
    { label: 'Sampled for deep review', value: projection.deepReviewSampleLabel, note: `illustrative · ${projection.deepReviewPct}% audited · ${projection.fastSendPct}% 1-click ready`, color: 'text-amber-300' },
    { label: 'Coordinator time saved', value: projection.hoursSavedPerCoordinator, note: 'illustrative model / coordinator / day', color: 'text-violet-300' },
  ]
  return (
    <div className="w-72 shrink-0 space-y-4">
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Projected impact (illustrative)</p>
        </div>
        <div className="space-y-3">
          {stats.map(s => (
            <div key={s.label} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 leading-tight">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.note}</p>
              </div>
              <span className={`text-sm font-bold font-mono shrink-0 ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-start gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">Human authorization required on every send — automation governs assembly depth, not transmission.</p>
        </div>
      </div>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3"><History className="w-3.5 h-3.5 text-slate-400" /><p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Change log (demo fixture)</p></div>
        <div className="space-y-3">
          {CHANGE_LOG.map((entry, i) => (
            <div key={i} className="relative pl-3 border-l border-slate-700/60">
              <p className="text-xs font-medium text-slate-300 leading-tight">{entry.change}</p>
              {entry.reason && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.reason}</p>}
              <p className="text-xs text-slate-600 mt-1">{entry.date} · {entry.who}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AutomationPolicyView({ onOpenCase }: { onOpenCase?: (scenarioId: string, status: CaseStatus) => void } = {}) {
  const [autoAssemble, setAutoAssemble] = useState(true)
  const [sampleRate, setSampleRate] = useState(20)
  const projection = computePolicyProjection(autoAssemble, sampleRate, 55)
  const queueRows = previewQueueUnderPolicy(initialClients, autoAssemble, sampleRate)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold font-display text-white">Automation Policy</h1>
            <CapabilityChip cap="simulated" />
            <IllustrativeTag />
          </div>
          <p className="text-sm text-slate-400 mt-0.5">How much routine volume to auto-assemble and queue vs. review in depth — illustrative projections only</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700" title={`Operating as ${TENANT.name} — ${TENANT.type}.`}>
          <Building2 className="w-3 h-3 text-slate-400" /><span className="text-slate-200 font-medium">{TENANT.name}</span>
        </span>
      </div>
      <div className="px-8 py-6 flex gap-6 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              ClearAuth stands up the capability and defaults at onboarding; your PA team tunes sampling thresholds below — previewed locally on demo fixture cases before applying.
            </p>
          </div>
          <ReviewPolicyControl
            routineVolumePct={55} autoAssemble={autoAssemble} onToggleAutoAssemble={setAutoAssemble}
            sampleRate={sampleRate} onChangeSampleRate={setSampleRate}
          />
          <FixtureQueueRoutingPreview rows={queueRows} onOpenCase={onOpenCase} />
        </div>
        <PolicyRightRail projection={projection} />
      </div>
    </div>
  )
}
