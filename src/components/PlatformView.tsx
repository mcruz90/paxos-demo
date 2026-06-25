import { useState, Fragment } from 'react'
import { FileText, ChevronRight, Package, Info, GitBranch, Rocket, Database, Workflow, Blocks, AlertTriangle } from 'lucide-react'
import { type IconType, type View } from '../types'
import { scenarios } from '../data/scenarios'
import { InfoHint, RoleChip } from './ui'
import { ArtifactControls, EditableRecordList, JustPublishedBanner, SandboxPromotionBar, useVersioned, VersionHistoryPanel } from './versioning'
import { CONNECTORS } from './OnboardingView'
import { computePackDeltas, PACK_DRIFT, PACK_PROVENANCE, PACK_REGISTRY_HISTORY, type PackRegistryData } from './LibraryView'

export function PlatformView({ setView }: { setView: (v: View) => void }) {
  const policyPackCount = new Set(Object.values(scenarios).map(s => s.configFile)).size
  const vs = useVersioned<PackRegistryData>(PACK_REGISTRY_HISTORY)
  const [expandedPack, setExpandedPack] = useState<string | null>(null)
  const packData = vs.editing && vs.draft ? vs.draft : vs.current
  const packDeltas = vs.editing && vs.draft ? computePackDeltas(vs.current, vs.draft) : []
  const packStatusCls: Record<string, string> = {
    active: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    draft: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    deprecated: 'text-slate-400 bg-slate-700/40 border-slate-600/30',
  }

  const REUSABLE_GROUPS: { title: string; subtitle: string; icon: IconType; items: { name: string; meta: string; deployments?: number }[] }[] = [
    {
      title: 'Data Connectors', subtitle: 'Reusable adapters — the only client-specific layer', icon: Database,
      items: CONNECTORS.map(c => ({ name: c.name, meta: c.vendors, deployments: c.deployments })),
    },
    {
      title: 'Canonical Schema', subtitle: 'Shared ontology every connector normalizes into', icon: Blocks,
      items: [
        { name: 'Rule primitives', meta: 'Diagnostic · Temporal · Math · Safety', deployments: 42 },
        { name: 'Canonical entities', meta: 'drug · diagnosis · plan_id · denial_reason · lab_values', deployments: 42 },
      ],
    },
    {
      title: 'Prompt Templates', subtitle: 'Versioned, shared across all deployments', icon: FileText,
      items: [
        { name: 'Appeal Letter', meta: 'Structured-section template', deployments: 42 },
        { name: 'Counter-Argument', meta: 'Round 2 dose/criteria dispute', deployments: 31 },
        { name: 'Exception Summary', meta: 'Missing-documentation report', deployments: 42 },
      ],
    },
    {
      title: 'Eval Suites', subtitle: 'Quality gates applied to every client at onboarding and in production', icon: Workflow,
      items: [
        { name: 'Structural', meta: 'Deterministic section/field checks', deployments: 42 },
        { name: 'Claim-Citation Alignment', meta: 'Traceability scoring', deployments: 42 },
        { name: 'Safety Gate', meta: 'Deterministic rule check', deployments: 42 },
      ],
    },
    {
      title: 'Shared Engine', subtitle: 'The implementation pattern every client runs on', icon: GitBranch,
      items: [
        { name: '4-node LangGraph DAG', meta: 'Ingestion → Retrieval → Synthesis → Gatekeeper', deployments: 42 },
        { name: 'Deterministic Gatekeeper', meta: 'Non-LLM safety boundary', deployments: 42 },
        { name: 'Tiered HITL router', meta: 'Routine / Complex / Exception', deployments: 42 },
        { name: 'Payer Transmission', meta: 'Initial PA: Da Vinci PAS · X12 278 · appeals: payer channel · fax fallback', deployments: 42 },
      ],
    },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Platform Registry</h1>
          <p className="text-sm text-slate-400 mt-0.5">The centralized system of reusable components shared across every client deployment</p>
        </div>
        <div className="flex items-center gap-2">
          <RoleChip layer="scale" />
          <button onClick={() => setView('onboarding')} className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Rocket className="w-4 h-4" />Onboard a Client
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">

        {/* Headline */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Client Deployments', value: '42',  sub: 'on the shared platform' },
            { label: 'Reusable Connectors', value: `${CONNECTORS.length}`, sub: 'cover every client data source' },
            { label: 'Policy Packs',         value: '120+',  sub: `drug × carrier configs · ${policyPackCount} shown below` },
            { label: 'Avg Component Reuse',  value: '93%', sub: 'on a new onboarding' },
          ].map(m => (
            <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
              <p className="text-2xl font-bold font-mono text-emerald-300 leading-none">{m.value}</p>
              <p className="text-xs text-slate-500 mt-2">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Thesis callout */}
        <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-400 leading-relaxed">
            Every customer runs on the same engine, schema, prompts, and evals. The <span className="text-slate-300 font-medium">only</span> client-specific work is the connector + field-mapping layer — so onboarding a new client is a configuration session, not a custom build. This is what turns ~40 bespoke workflows into a platform.
          </p>
        </div>

        {/* Reusable component groups */}
        {REUSABLE_GROUPS.map(group => {
          const GroupIcon = group.icon
          return (
            <div key={group.title}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                  <GroupIcon className="w-4 h-4 text-slate-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.title}</h2>
                  <p className="text-xs text-slate-500">{group.subtitle}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {group.items.map(item => (
                  <div key={item.name} className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500 truncate">{item.meta}</p>
                    </div>
                    {item.deployments !== undefined && (
                      <span className="text-xs font-mono text-slate-400 bg-slate-700/40 px-2 py-0.5 rounded-full shrink-0 cursor-help" title={`Reused by ${item.deployments} of 42 client deployments — how many live customers share this exact component`}>{item.deployments}×</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Guideline drift — packs decay as guidelines/policies change; flagged + re-gated */}
        {PACK_DRIFT.map(d => (
          <div key={d.pack} className="flex items-start gap-3 px-4 py-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">Guideline drift detected · <span className="font-mono text-amber-300">{d.pack}</span></p>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">{d.source} ({d.detected}). {d.summary}</p>
              <p className="text-xs text-slate-500 mt-1.5"><span className="text-amber-300/90 font-medium">{d.affectedDeployments} deployments paused</span> · {d.action} → re-gated through the <button onClick={() => setView('rubric')} className="text-emerald-400 hover:underline">eval suite</button> before resume. A RAG pack is only as current as the guideline it encodes.</p>
            </div>
          </div>
        ))}

        {/* Policy Pack Registry — the shared store, resolved per case */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-white">Policy Pack Registry</h2>
              <p className="text-xs text-slate-500">The shared, versioned store of payer × plan × drug coverage rules. Resolved per case from the patient's plan — seeded for high-volume policies, synthesized on first demand for the long tail. Editing is eval-gated.</p>
            </div>
            <ArtifactControls version={vs.latest.version} editing={vs.editing} onToggleHistory={() => vs.setShowHistory(s => !s)} onEdit={vs.startEdit} />
          </div>
          {vs.justPublished !== null && !vs.editing && <div className="mb-3"><JustPublishedBanner version={vs.justPublished} scope="Pack changes propagate to every client deployment that resolves them." /></div>}
          {vs.editing ? (
            <EditableRecordList
              items={packData.packs}
              onChange={packs => vs.setDraft(d => d ? { ...d, packs } : d)}
              addLabel="Add policy pack"
              blank={{ pack: '', drug: '', carrier: '', category: '', status: 'draft' }}
              fields={[
                { key: 'pack', placeholder: 'config file', grow: 3 },
                { key: 'drug', placeholder: 'drug', grow: 2 },
                { key: 'carrier', placeholder: 'carrier / plan', grow: 3 },
                { key: 'category', placeholder: 'category', grow: 2 },
                { key: 'status', placeholder: 'status', grow: 2, options: ['active', 'draft', 'deprecated'] },
              ]}
            />
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Policy Pack</th>
                    <th className="text-left px-4 py-3 font-medium">Drug</th>
                    <th className="text-left px-4 py-3 font-medium">Carrier / Plan</th>
                    <th className="text-left px-4 py-3 font-medium">Channel</th>
                    <th className="text-left px-4 py-3 font-medium inline-flex items-center gap-1.5">Materialization<InfoHint text="How this pack entered the registry — seeded/reused across N cases (a registry hit) or synthesized on first demand from the payer's published policy." wide /></th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {packData.packs.map((p, i) => {
                    const prov = PACK_PROVENANCE[p.pack]
                    const drift = PACK_DRIFT.find(d => d.pack === p.pack)
                    const sc = Object.values(scenarios).find(s => s.configFile === p.pack)
                    const open = expandedPack === p.pack
                    return (
                      <Fragment key={i}>
                        <tr onClick={() => setExpandedPack(open ? null : p.pack)} className="hover:bg-slate-700/20 transition-colors cursor-pointer">
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            <span className="inline-flex items-center gap-1.5">
                              <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-90' : ''}`} />
                              {p.pack}{prov ? ` · ${prov.version}` : ''}
                              {drift && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30" title={`${drift.source} (${drift.detected}) — paused for re-validation`}><AlertTriangle className="w-2.5 h-2.5" />stale</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{p.drug}</td>
                          <td className="px-4 py-3 text-slate-400">{p.carrier}</td>
                          <td className="px-4 py-3 text-slate-400">{prov?.channel ?? 'Pharmacy'}</td>
                          <td className="px-4 py-3">{prov ? <span className={prov.status === 'synthesized' ? 'text-violet-300' : 'text-slate-400'}>{prov.detail}</span> : <span className="text-slate-500">—</span>}</td>
                          <td className="px-4 py-3 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${packStatusCls[p.status] ?? 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>{p.status}</span></td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-900/40">
                            <td colSpan={6} className="px-4 py-4">
                              {sc ? (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-xs text-slate-400">Decision rules render in the <button onClick={e => { e.stopPropagation(); setView('specs') }} className="text-emerald-400 hover:underline">Workflow Spec</button>; the stored config is below.</p>
                                    {sc.overriddenFields && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/30">plan override of base</span>}
                                  </div>
                                  {sc.overriddenFields && (
                                    <div className="space-y-1">
                                      {sc.overriddenFields.map(o => (
                                        <p key={o.label} className="text-xs"><span className="text-slate-400">{o.label}: </span><span className="line-through text-slate-600">{o.base}</span><span className="text-slate-500"> → </span><span className="text-violet-300">{o.override}</span></p>
                                      ))}
                                    </div>
                                  )}
                                  <pre className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-[11px] font-mono text-slate-400 overflow-x-auto leading-relaxed">{sc.configJson}</pre>
                                </div>
                              ) : <p className="text-xs text-slate-500">No compiled config on file for this pack.</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {vs.editing && <div className="mt-3"><SandboxPromotionBar deltas={packDeltas} changeNote={vs.changeNote} setChangeNote={vs.setChangeNote} onPromote={r => vs.promote(packDeltas, r)} onDiscard={r => vs.discardExperiment(r)} /></div>}
          {vs.showHistory && <div className="mt-3"><VersionHistoryPanel title="Policy Pack Registry" versions={vs.versions} latestVersion={vs.latest.version} editing={vs.editing} onRevert={v => vs.revertTo(v, computePackDeltas)} experiments={vs.experiments} /></div>}
        </div>

        <p className="text-xs text-slate-600 pb-4">
          Deployment counts (<span className="font-mono">N×</span>) show how many client deployments share each component. Figures reflect this demo benchmark.
        </p>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared versioning infrastructure (CRUD + audit trail for Build artifacts)
// ---------------------------------------------------------------------------
