import { useState } from 'react'
import { Wrench, ChevronDown } from 'lucide-react'
import type { ScenarioConfig } from '../../types'
import { COVERAGE_RESOLUTION } from './coverage'
import { buildPasPayload } from './payload'

// The case's technical record — collapsed by default and kept out of the
// claims specialist's way. Holds the engineering/platform details that the
// client view deliberately abstracts away: the pipeline/config provenance, the
// coverage pack resolution (key/version/registry stats), and the transmission
// payload (FHIR / X12 278). Surfaced here for technical Operate staff and ClearAuth
// support — the record you'd pull up to diagnose a transmission/network error —
// and logged with the case for audit.
export function CaseTechnicalDetails({ scenario }: { scenario: ScenarioConfig }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'fhir' | 'x12'>('fhir')
  const cov = COVERAGE_RESOLUTION[scenario.id]
  const payload = scenario.lifecycle === 'initial_pa' ? buildPasPayload(scenario) : null

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Wrench className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Technical details</span>
          <span className="text-xs text-slate-500">for technical staff, support &amp; records</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-700/40 divide-y divide-slate-700/30">
          {/* Pipeline & config */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-slate-400 mb-1">Pipeline &amp; config</p>
            <div className="text-xs font-mono text-slate-400 space-y-0.5">
              <div>engine: 4-node DAG · Ingestion → Retrieval → Synthesis → Gatekeeper</div>
              <div>config: <span className="text-slate-300">{scenario.configFile}</span></div>
            </div>
          </div>

          {/* Coverage resolution technicals */}
          {cov && (
            <div className="px-4 py-3 space-y-1">
              <p className="text-xs font-medium text-slate-400 mb-1">Coverage resolution</p>
              <div className="text-xs font-mono text-slate-400 space-y-0.5">
                <div>pack: <span className="text-slate-300">{cov.pack} · {cov.version}</span> · eff. {cov.effective} · {cov.channel}</div>
                <div>resolution: <span className="text-slate-300">{cov.status === 'synthesized' ? 'synthesized on demand' : 'registry hit'}</span></div>
                <div className="font-sans text-slate-500">{cov.detail}</div>
              </div>
            </div>
          )}

          {/* Transmission payload (initial PA) */}
          {payload && (
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-medium text-slate-400">Transmission payload</p>
                <div className="flex items-center gap-1">
                  {([['fhir', 'FHIR Bundle (Da Vinci PAS)'], ['x12', 'X12 278']] as const).map(([t, l]) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="px-3 py-2.5 text-xs leading-relaxed font-mono text-slate-300 overflow-auto max-h-80 bg-slate-900/50 rounded-lg border border-slate-700/40">
                {tab === 'fhir' ? payload.fhir : payload.x12}
              </pre>
            </div>
          )}

          <div className="px-4 py-2.5">
            <p className="text-xs text-slate-500 leading-relaxed">
              Logged with the case for audit and support. Surfaced for technical Operate staff and ClearAuth support — e.g. diagnosing a transmission/network error on a submission. Not needed for routine review.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
