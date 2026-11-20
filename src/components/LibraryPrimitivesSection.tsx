import { useState } from 'react'
import { ArrowRight, Pencil, Plus } from 'lucide-react'
import { universalPrimitives } from '../data/scenarios'
import { type RuleType, type UniversalPrimitive, type View } from '../types'
import { PACK_REGISTRY_V1 } from './libraryData'
import { PrimitiveRunPanel } from './PrimitiveRunPanel'
import { ruleColors, ruleIcons } from './ui'

function PrimitiveCard({
  primitive, selected, editing, editDraft, setEditDraft, onSelect, onStartEdit, onSave, onCancel,
}: {
  primitive: UniversalPrimitive; selected: boolean; editing: boolean
  editDraft: { description: string; params: string }
  setEditDraft: React.Dispatch<React.SetStateAction<{ description: string; params: string }>>
  onSelect: () => void; onStartEdit: () => void; onSave: () => void; onCancel: () => void
}) {
  const v = primitive.version ?? 1
  return (
    <div
      id={`tour-primitive-${primitive.type}`} onClick={onSelect}
      className={`rounded-xl border p-4 cursor-pointer transition-all ${selected ? 'bg-emerald-500/[0.06] border-emerald-500/50 ring-1 ring-emerald-500/20' : 'bg-slate-800/40 border-slate-700/60 hover:border-emerald-500/40'}`}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className={`p-1.5 rounded border ${ruleColors[primitive.type]}`}>{ruleIcons[primitive.type]}</div>
        <p className="text-sm font-semibold text-white">{primitive.name}</p>
        <span className="text-xs font-mono text-slate-400">{primitive.schemaClass}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${primitive.isNew ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : v > 1 ? 'bg-sky-500/15 border-sky-500/30 text-sky-300' : 'bg-slate-700/40 border-slate-600/40 text-slate-400'}`}>
          {primitive.isNew ? 'new' : v > 1 ? `v${v} · modified` : 'v1'}
        </span>
        {!editing && (
          <button onClick={e => { e.stopPropagation(); onStartEdit() }} className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-600 text-slate-300 transition-colors">
            <Pencil className="w-3 h-3" />Edit
          </button>
        )}
      </div>
      {editing ? (
        <textarea value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} rows={3} className="w-full mt-2 px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
      ) : (
        <p className="text-xs text-slate-300 leading-relaxed mt-2">{primitive.description}</p>
      )}
      <div className="mt-2.5">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Parameters</p>
        {editing ? (
          <textarea value={editDraft.params} onChange={e => setEditDraft(d => ({ ...d, params: e.target.value }))} rows={4} className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none" />
        ) : (
          <div className="bg-slate-900/40 rounded-lg p-2.5 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0.5 font-mono text-[11px]">
            {primitive.params.map(param => <p key={param} className="text-slate-400 break-all">{param}</p>)}
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={onSave} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium">Save · eval-gate change</button>
        </div>
      )}
    </div>
  )
}

function AddPrimitiveForm({
  draft, setDraft, onAdd, onCancel,
}: {
  draft: { name: string; schemaClass: string; description: string; params: string }
  setDraft: React.Dispatch<React.SetStateAction<{ name: string; schemaClass: string; description: string; params: string }>>
  onAdd: () => void; onCancel: () => void
}) {
  return (
    <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">New Rule Primitive</p>
      <div className="grid grid-cols-2 gap-3">
        <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Name (e.g. Network Rule)" className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500" />
        <input value={draft.schemaClass} onChange={e => setDraft(d => ({ ...d, schemaClass: e.target.value }))} placeholder="Schema Class (e.g. NetworkRule)" className="px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500" />
      </div>
      <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} placeholder="What this rule checks..." className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 resize-none" />
      <textarea value={draft.params} onChange={e => setDraft(d => ({ ...d, params: e.target.value }))} rows={3} placeholder="Parameters (one per line)" className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-sm font-mono text-white placeholder-slate-500 resize-none" />
      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">Cancel</button>
        <button onClick={onAdd} disabled={!draft.name.trim() || !draft.schemaClass.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"><Plus className="w-3.5 h-3.5" />Add Primitive</button>
      </div>
    </div>
  )
}

function RegistryPacksCard({ setView }: { setView: (v: View) => void }) {
  return (
    <div>
      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Per-payer instances · in the Platform Registry</p>
      <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            One pack per drug × carrier resolved per case via BIN/PCN/Group from the <button onClick={() => setView('platform')} className="text-emerald-400 hover:underline">Platform Registry</button>.
          </p>
          <button onClick={() => setView('platform')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium shrink-0">
            Open Registry<ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PACK_REGISTRY_V1.packs.map(p => (
            <div key={p.pack} className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-white truncate">{p.drug}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 ml-auto shrink-0">{p.status}</span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{p.carrier}</p>
              <p className="text-[10px] font-mono text-slate-600 truncate mt-0.5">{p.pack}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LibraryPrimitivesSection({ setView }: { setView: (v: View) => void }) {
  const [selectedPrimType, setSelectedPrimType] = useState<RuleType>(universalPrimitives[0].type)
  const [primitives, setPrimitives] = useState<UniversalPrimitive[]>(universalPrimitives)
  const [showAdd, setShowAdd] = useState(false)
  const [newDraft, setNewDraft] = useState({ name: '', schemaClass: '', description: '', params: '' })
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ description: '', params: '' })

  const saveEdit = (name: string) => {
    const params = editDraft.params.split('\n').map(s => s.trim()).filter(Boolean)
    setPrimitives(prev => prev.map(p => p.name === name ? { ...p, description: editDraft.description.trim() || p.description, params, version: (p.version ?? 1) + 1 } : p))
    setEditingName(null)
  }

  const addPrimitive = () => {
    setPrimitives(prev => [...prev, { type: 'custom' as RuleType, schemaClass: newDraft.schemaClass, name: newDraft.name, description: newDraft.description, params: newDraft.params.split('\n').map(p => p.trim()).filter(Boolean), isNew: true }])
    setNewDraft({ name: '', schemaClass: '', description: '', params: '' }); setShowAdd(false)
  }

  return (
    <div className="space-y-8">
      <div id="tour-layer1">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">Shared vocabulary · payer-agnostic</p>
            <h2 className="text-base font-semibold text-white mb-1">Universal Rule Primitives</h2>
            <p className="text-xs text-slate-500">Reusable vocabulary across every policy pack — diagnostic, math/biomarker, temporal, safety, provider, and quantity primitives.</p>
          </div>
          <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors shrink-0">
            <Plus className="w-3.5 h-3.5" />Add Primitive
          </button>
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0 space-y-3">
            {primitives.map((p, i) => (
              <PrimitiveCard
                key={`${p.type}-${i}`} primitive={p} selected={selectedPrimType === p.type} editing={editingName === p.name}
                editDraft={editDraft} setEditDraft={setEditDraft} onSelect={() => setSelectedPrimType(p.type)}
                onStartEdit={() => { setShowAdd(false); setEditingName(p.name); setEditDraft({ description: p.description, params: p.params.join('\n') }) }}
                onSave={() => saveEdit(p.name)} onCancel={() => setEditingName(null)}
              />
            ))}
            {showAdd && <AddPrimitiveForm draft={newDraft} setDraft={setNewDraft} onAdd={addPrimitive} onCancel={() => setShowAdd(false)} />}
          </div>
          <div className="lg:w-[400px] shrink-0"><div className="lg:sticky lg:top-6"><PrimitiveRunPanel type={selectedPrimType} /></div></div>
        </div>
      </div>
      <RegistryPacksCard setView={setView} />
    </div>
  )
}
