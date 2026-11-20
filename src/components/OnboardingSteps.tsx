import { ArrowRight, Beaker, CheckCircle, Info, Package, ShieldCheck } from 'lucide-react'
import { type View } from '../types'
import { CATEGORY_CLS, CONNECTORS, getSamplePayloadPreview, ONBOARDING_TEMPLATES, type OnboardingTemplate } from './onboardingData'
import { ReviewPolicyControl } from './ReviewPolicyControl'
import { MarketBadge } from './WorkflowSpecView'

export function ConfidencePill({ v }: { v: number }) {
  const cls = v >= 95 ? 'text-emerald-300 bg-emerald-500/10' : v >= 85 ? 'text-sky-300 bg-sky-500/10' : 'text-amber-300 bg-amber-500/10'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${cls}`}>{v}%</span>
}

export function ClientProfileStep({ templateId, onPick }: { templateId: string | null; onPick: (id: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Select the client archetype to onboard. Their profile seeds connector defaults and shared policy packs.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ONBOARDING_TEMPLATES.map(t => {
          const Icon = t.icon
          const active = templateId === t.id
          return (
            <button
              key={t.id} onClick={() => onPick(t.id)}
              className={`text-left p-5 rounded-xl border transition-all ${active ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                  <Icon className={`w-5 h-5 ${active ? 'text-emerald-400' : 'text-slate-300'}`} />
                </div>
                <div><p className="text-sm font-semibold text-white">{t.company}</p><p className="text-xs text-slate-500">{t.type}</p></div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{t.blurb}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DataSourcesStep({
  template, selectedConnectors, onToggle,
}: {
  template: OnboardingTemplate; selectedConnectors: Set<string>; onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /><p className="text-xs text-slate-400 leading-relaxed">{template.dataStory}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {CONNECTORS.map(c => {
          const Icon = c.icon
          const on = selectedConnectors.has(c.id)
          return (
            <button
              key={c.id} onClick={() => onToggle(c.id)}
              className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all ${on ? 'bg-slate-800/70 border-slate-600' : 'bg-slate-900/40 border-slate-800 opacity-55 hover:opacity-90'}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${CATEGORY_CLS[c.category]}`}><Icon className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-200">{c.name}</p><span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_CLS[c.category]}`}>{c.category}</span></div>
                <p className="text-xs text-slate-500 mt-0.5">{c.ingests} · <span className="font-mono">{c.vendors}</span></p>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function FieldMappingStep({ template }: { template: OnboardingTemplate }) {
  const preview = getSamplePayloadPreview(template.id)
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        The adapter normalizes <span className="text-slate-300 font-medium">{template.company}</span>&rsquo;s source fields into the shared canonical ontology schema + specialty-preserving PHI tokens.
      </p>
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Source Field ({template.company})</th>
              <th className="px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium">Canonical Schema</th>
              <th className="text-center px-4 py-3 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {template.fieldMappings.map(m => (
              <tr key={m.source} className="hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-2.5 font-mono text-slate-400">{m.source}</td>
                <td className="px-2 py-2.5 text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-600 inline" /></td>
                <td className="px-4 py-2.5 font-mono text-emerald-400">{m.canonical}</td>
                <td className="px-4 py-2.5 text-center"><ConfidencePill v={m.confidence} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wide">Raw Source Payload → Canonical AppealRequest Normalization Preview</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300"><ShieldCheck className="w-3.5 h-3.5" />{preview.deidTokenPreview}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{preview.rawFormat}</p>
            <p className="font-mono text-[11px] text-slate-300 break-words leading-relaxed">{preview.rawSnippet}</p>
          </div>
          <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 mb-1.5">Canonical AppealRequest Schema</p>
            <div className="grid grid-cols-1 gap-1 font-mono text-[11px]">
              {Object.entries(preview.normalizedJson).map(([k, v]) => (
                <p key={k} className="text-slate-300"><span className="text-emerald-400">{k}:</span> {v}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CoverageScopeStep({ template, setView }: { template: OnboardingTemplate; setView: (v: View) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        ClearAuth <span className="text-slate-300">resolves</span> matching packs from the shared <button onClick={() => setView('platform')} className="text-emerald-400 hover:underline">Policy Pack Registry</button> per case via BIN/PCN/Group.
      </p>
      <div className="space-y-2.5">
        {template.policyPacks.map(p => (
          <div key={p.name} className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl">
            <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0"><Package className="w-4 h-4 text-slate-300" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-emerald-400">{p.name}</p>
              <div className="flex items-center gap-2 mt-0.5"><p className="text-xs text-slate-500">{p.category}</p><MarketBadge market={p.market} /></div>
            </div>
            <span className="text-xs text-emerald-300 inline-flex items-center gap-1.5 shrink-0"><CheckCircle className="w-4 h-4" />Registry hit</span>
          </div>
        ))}
        <div className="flex items-center gap-4 p-4 bg-violet-950/20 border border-violet-500/30 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0"><Beaker className="w-4 h-4 text-violet-300" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200">Long tail — synthesized on first case</p>
            <p className="text-xs text-slate-500">Synthesized from payer policy, eval-gated, then cached across all deployments.</p>
          </div>
          <span className="text-xs text-violet-300 shrink-0">Auto-synthesize</span>
        </div>
      </div>
    </div>
  )
}

export function ReviewTiersStep({ template, setView }: { template: OnboardingTemplate; setView: (v: View) => void }) {
  const tiers = [
    { tier: 'Routine', pct: template.hitl.routine, cls: 'text-emerald-300', bar: 'bg-emerald-500', note: '~3 min · summary review' },
    { tier: 'Complex', pct: template.hitl.complex, cls: 'text-amber-300', bar: 'bg-amber-500', note: '~10 min · full letter' },
    { tier: 'Exception', pct: template.hitl.exception, cls: 'text-red-300', bar: 'bg-red-500', note: 'Investigation required' },
  ]
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Deterministic review-depth routing for {template.company}. Humans approve every submission.</p>
      <div className="grid grid-cols-3 gap-4">
        {tiers.map(t => (
          <div key={t.tier} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
            <span className={`text-2xl font-bold font-mono ${t.cls}`}>{t.pct}%</span>
            <div className="w-full h-1 rounded-full bg-slate-700"><div className={`h-1 rounded-full ${t.bar}`} style={{ width: `${t.pct}%` }} /></div>
            <p className="text-xs font-semibold text-slate-300">{t.tier}</p>
            <p className="text-xs text-slate-500">{t.note}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Tunable day-to-day in <button onClick={() => setView('automation')} className="text-emerald-400 hover:underline">Operate → Automation Policy</button>:
      </p>
      <ReviewPolicyControl routineVolumePct={template.hitl.routine} readOnly />
    </div>
  )
}
