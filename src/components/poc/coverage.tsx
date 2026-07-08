import { ArrowRight } from 'lucide-react'
import { InfoHint } from '../ui'
import { scenarios } from '../../data/scenarios'

export interface CoverageResolution {
  channel: 'pharmacy' | 'medical'
  bin: string
  pcn: string
  group: string
  pack: string        // resolved pack key
  version: string
  effective: string   // effective date of the resolved pack version
  status: 'resolved' | 'synthesized'
  detail: string      // provenance: reuse count (hit) or synthesis basis (miss)
}

export const COVERAGE_RESOLUTION: Record<string, CoverageResolution> = {
  'novo-ozempic': {
    channel: 'pharmacy', bin: '004336', pcn: 'ADV', group: 'RX8294',
    pack: 'ozempic_cigna_base', version: 'v3', effective: 'Jan 1, 2026',
    status: 'resolved', detail: 'Registry hit — this pack has resolved 214 prior cases across all clients.',
  },
  'novo-ozempic-initial': {
    channel: 'pharmacy', bin: '004336', pcn: 'ADV', group: 'RX8294',
    pack: 'ozempic_cigna_base', version: 'v3', effective: 'Jan 1, 2026',
    status: 'resolved', detail: 'Registry hit — same pack as the Ozempic appeal, reused for this initial PA. 215 prior cases across all clients.',
  },
  'novo-ozempic-docgap': {
    channel: 'pharmacy', bin: '004336', pcn: 'ADV', group: 'RX8294',
    pack: 'ozempic_cigna_base', version: 'v3', effective: 'Jan 1, 2026',
    status: 'resolved', detail: 'Registry hit — same pack reused for this pre-submission documentation gap case. Prescriber attestation pending before PAS filing. 215 prior cases across all clients.',
  },
  'pediatric-esomeprazole': {
    channel: 'pharmacy', bin: '610502', pcn: 'UHC', group: 'CHOICE21',
    pack: 'esomeprazole_uhc_pediatric', version: 'v2', effective: 'Apr 1, 2026',
    status: 'resolved', detail: 'Registry hit — this pack has resolved 38 prior cases across all clients.',
  },
  'gilead-livdelzi': {
    channel: 'pharmacy', bin: '610415', pcn: 'ADV', group: 'CIGNA-PPO',
    pack: 'livdelzi_cigna_hepatology', version: 'v1', effective: 'Jun 26, 2026',
    status: 'synthesized', detail: 'First case on this plan × drug platform-wide — pack synthesized from the Cigna PA policy and eval-gated before use. Now persisted for reuse.',
  },
}

// Client-facing coverage line — what a claims specialist needs: the plan routing
// (BIN/PCN/Group, which they use daily) resolving to a named policy, plus the
// effective date. The platform internals (pack key/version, registry hit vs.
// synthesized, reuse counts) live in the case's Technical details, not here.
export function CoverageResolutionLine({ scenarioId }: { scenarioId: string }) {
  const r = COVERAGE_RESOLUTION[scenarioId]
  const sc = scenarios[scenarioId]
  if (!r || !sc) return null
  const policyLabel = `${sc.plan} · ${sc.drug.split(' ')[0]} policy`
  return (
    <div className="rounded-xl px-5 py-4 border bg-slate-800/40 border-slate-700/60">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5">
          Coverage
          <InfoHint text="The patient's plan identifiers (BIN/PCN/Group) plus the drug determine which coverage policy applies — like a pharmacy claim routing to the right plan." wide />
        </p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/20">Coverage confirmed</span>
      </div>
      <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">BIN {r.bin}</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">PCN {r.pcn}</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">GRP {r.group}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="px-1.5 py-0.5 rounded text-emerald-300 bg-emerald-500/10 font-sans">{policyLabel}</span>
        <span className="text-slate-600">eff. {r.effective}</span>
        <span className="text-slate-600 uppercase">· {r.channel}</span>
      </div>
      <p className="text-xs text-slate-500 mt-2 leading-relaxed">The patient&rsquo;s plan matches an active coverage policy for this drug.</p>
    </div>
  )
}
