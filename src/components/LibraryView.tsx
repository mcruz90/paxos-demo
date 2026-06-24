import { useState } from 'react'
import { Plus, Info, Pencil } from 'lucide-react'
import { type RuleType, type UniversalPrimitive, type View } from '../types'
import { scenarios, universalPrimitives } from '../data/scenarios'
import { ruleColors, ruleIcons } from './ui'
import { ARTIFACT_ACTOR, diffList, type VersionEntry } from './versioning'
import { LifecycleSkeleton } from './LifecycleSkeleton'

export interface PolicyPack { pack: string; drug: string; carrier: string; category: string; status: string }
export interface PackRegistryData { packs: PolicyPack[] }

export const PACK_REGISTRY_V1: PackRegistryData = {
  packs: Object.values(scenarios).map(s => ({ pack: s.configFile, drug: s.drug.split(' ')[0], carrier: s.plan, category: s.categoryLabel, status: 'active' })),
}
export const PACK_REGISTRY_HISTORY: VersionEntry<PackRegistryData>[] = [
  { version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial policy-pack registry', deltas: ['Initial version'], snapshot: PACK_REGISTRY_V1 },
]
export function computePackDeltas(prev: PackRegistryData, next: PackRegistryData): string[] {
  const d = diffList(prev.packs, next.packs, 'pack', p => `${p.pack} (${p.status})`)
  return d.length ? d : ['No changes']
}

// Guideline drift — RAG/policy packs decay as the underlying medical guidelines and
// payer policies change. A monitor flags affected packs and pauses them for eval-gated
// re-validation rather than silently serving stale criteria. Keyed by config file.
export interface PackDrift {
  pack: string
  detected: string
  source: string
  summary: string
  affectedDeployments: number
  action: string
}
export const PACK_DRIFT: PackDrift[] = [
  {
    pack: 'omeprazole_uhc_pediatric.json',
    detected: 'Jun 16, 2026',
    source: 'NASPGHAN/ESPGHAN pediatric GERD dosing guidance revision',
    summary: 'The infant omeprazole dosing range this pack encodes was superseded by an updated guideline. Packs citing the prior version are flagged until re-validated against current guidance.',
    affectedDeployments: 14,
    action: 'Affected deployments paused · re-validation queued against the eval suite',
  },
]

// How each pack entered the shared registry — demo provenance keyed by config file.
export const PACK_PROVENANCE: Record<string, { channel: string; version: string; status: 'resolved' | 'synthesized'; detail: string }> = {
  'ozempic_cigna_base.json':       { channel: 'Pharmacy', version: 'v3', status: 'resolved',    detail: 'reused across 214 cases' },
  'omeprazole_uhc_pediatric.json': { channel: 'Pharmacy', version: 'v2', status: 'resolved',    detail: 'reused across 38 cases' },
  'ocaliva_aetna_hepatology.json': { channel: 'Pharmacy', version: 'v1', status: 'synthesized', detail: 'synthesized on demand · Jun 9, 2026' },
}


export function LibraryView({ setView }: {
  setView: (v: View) => void
}) {
  const [primitives, setPrimitives] = useState<UniversalPrimitive[]>(universalPrimitives)
  const [showAddPrimitive, setShowAddPrimitive] = useState(false)
  const [primitiveDraft, setPrimitiveDraft] = useState({ name: '', schemaClass: '', description: '', params: '' })

  // Per-primitive editing — modify an existing primitive's description/params.
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ description: '', params: '' })
  const primVersion = (p: UniversalPrimitive) => p.version ?? 1
  const startEditPrimitive = (p: UniversalPrimitive) => {
    setShowAddPrimitive(false)
    setEditingName(p.name)
    setEditDraft({ description: p.description, params: p.params.join('\n') })
  }
  const saveEditPrimitive = (name: string) => {
    const params = editDraft.params.split('\n').map(s => s.trim()).filter(Boolean)
    setPrimitives(prev => prev.map(p => p.name === name
      ? { ...p, description: editDraft.description.trim() || p.description, params, version: primVersion(p) + 1 }
      : p))
    setEditingName(null)
  }

  const handleAddPrimitive = () => {
    const params = primitiveDraft.params.split('\n').map(p => p.trim()).filter(Boolean)
    setPrimitives(prev => [...prev, {
      type: 'custom' as RuleType,
      schemaClass: primitiveDraft.schemaClass,
      name: primitiveDraft.name,
      description: primitiveDraft.description,
      params,
      isNew: true,
    }])
    setPrimitiveDraft({ name: '', schemaClass: '', description: '', params: '' })
    setShowAddPrimitive(false)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800">
        <h1 className="text-xl font-bold font-display text-white">Ontology Library</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          The universal anatomy of a PA case — the schema every submission shares (initial request, appeal, or determination), regardless of drug or payer
        </p>
      </div>

      <div className="p-8 space-y-10">

        {/* Three-layer orientation */}
        <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-300">Three layers, one shared frame</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              The <em className="text-slate-400 not-italic font-medium">case skeleton</em> is the full lifecycle every case runs through (below).
              Its <code className="text-slate-400">Coverage Discovery</code> and <code className="text-slate-400">Documentation</code> stages are built from reusable <em className="text-slate-400 not-italic font-medium">rule primitives</em> (further below).
              The payer-specific values — thresholds, step therapy, exclusions — live in <em className="text-slate-400 not-italic font-medium">policy packs</em>, which are
              resolved per case from the <button onClick={() => setView('platform')} className="text-emerald-400 hover:underline">Platform Registry</button>, not authored here.
              This view is the shared lifecycle + schema; the registry holds the per-payer instances.
            </p>
          </div>
        </div>

        {/* The PA case skeleton — full lifecycle flowchart, editable + versioned */}
        <LifecycleSkeleton />

        {/* Layer 1: Universal Primitives */}
        <div id="tour-layer1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">1</div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white">Universal Rule Primitives</h2>
              <p className="text-xs text-slate-500">Atomic building blocks composed into every extraction pipeline. Existing primitives can be edited, not just added: an <span className="text-slate-400">additive</span> change — a new parameter or a new allowed value (e.g. adding a dose unit) — stays backward-compatible; a <span className="text-slate-400">breaking</span> change ships as a new schema version. Every change is eval-gated before it reaches live packs.</p>
            </div>
            <button
              onClick={() => setShowAddPrimitive(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />Add Primitive
            </button>
          </div>

          <div className="space-y-3">
            {primitives.map((p, i) => {
              const isEditing = editingName === p.name
              const v = primVersion(p)
              return (
              <div key={`${p.type}-${i}`} id={`tour-primitive-${p.type}`} className={`rounded-xl border p-4 ${ruleColors[p.type]} border-opacity-30`}>
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Left: definition */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`p-1.5 rounded border ${ruleColors[p.type]}`}>{ruleIcons[p.type]}</div>
                      <p className="text-sm font-semibold text-white">{p.name}</p>
                      <span className="text-xs font-mono text-slate-400">{p.schemaClass}</span>
                      {p.isNew
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">new</span>
                        : v > 1
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300">v{v} · modified</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/40 border border-slate-600/40 text-slate-400 font-mono">v1</span>}
                      {!isEditing && (
                        <button onClick={() => startEditPrimitive(p)} className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-600 text-slate-300 transition-colors">
                          <Pencil className="w-3 h-3" />Edit
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editDraft.description}
                        onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed">{p.description}</p>
                    )}
                  </div>
                  {/* Right: parameters */}
                  <div className="md:w-2/5 shrink-0 space-y-1">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Parameters</p>
                    {isEditing ? (
                      <textarea
                        value={editDraft.params}
                        onChange={e => setEditDraft(d => ({ ...d, params: e.target.value }))}
                        rows={6}
                        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    ) : (
                      <div className="bg-slate-900/50 rounded-lg p-2.5 font-mono text-xs space-y-0.5">
                        {p.params.map(param => (
                          <p key={param} className="text-slate-400 break-all">{param}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2.5">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Adding a parameter or a new allowed value (e.g. a dose unit) is <span className="text-slate-300">backward-compatible</span> — existing packs keep working. Renaming or removing one is a <span className="text-slate-300">breaking</span> change and ships as a new schema version. Saving runs the change through the eval suite before it propagates to live packs.
                    </p>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setEditingName(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
                      <button onClick={() => saveEditPrimitive(p.name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors">
                        Save · eval-gate change
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>

          {showAddPrimitive && (
            <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">New Rule Primitive</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Name</label>
                  <input
                    value={primitiveDraft.name}
                    onChange={e => setPrimitiveDraft(d => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Network / Coverage Rule"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Schema Class</label>
                  <input
                    value={primitiveDraft.schemaClass}
                    onChange={e => setPrimitiveDraft(d => ({ ...d, schemaClass: e.target.value }))}
                    placeholder="e.g. NetworkRule"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Description</label>
                <textarea
                  value={primitiveDraft.description}
                  onChange={e => setPrimitiveDraft(d => ({ ...d, description: e.target.value }))}
                  rows={2}
                  placeholder="What this rule checks and how the retrieval agent extracts it..."
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Parameters (one per line)</label>
                <textarea
                  value={primitiveDraft.params}
                  onChange={e => setPrimitiveDraft(d => ({ ...d, params: e.target.value }))}
                  rows={3}
                  placeholder={'plan_network_tier: Literal["in","out","preferred"]\nrequires_referral: bool'}
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={() => { setShowAddPrimitive(false); setPrimitiveDraft({ name: '', schemaClass: '', description: '', params: '' }) }}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPrimitive}
                  disabled={!primitiveDraft.name.trim() || !primitiveDraft.schemaClass.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />Add Primitive
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
