import { useState } from 'react'
import { Lock, Pencil, Plus, Shield, Zap } from 'lucide-react'
import { computeInstructionDeltas, type EditableInstruction, isNodeEditable, type InstructionStore, NODE_META, type NodeMeta } from './instructionsData'
import { ArtifactControls, type DimResult, JustPublishedBanner, SandboxPromotionBar, VersionHistoryPanel } from './versioning'

function EditableList({
  items, field, onUpdate, onAdd, onRemove,
}: {
  items: string[]; field: 'task' | 'guardrails'
  onUpdate: (field: 'task' | 'guardrails', i: number, v: string) => void
  onAdd: (field: 'task' | 'guardrails') => void; onRemove: (field: 'task' | 'guardrails', i: number) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            value={line} onChange={e => onUpdate(field, i, e.target.value)} rows={2}
            className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 resize-y focus:outline-none focus:border-slate-500"
          />
          <button onClick={() => onRemove(field, i)} className="w-7 h-7 rounded-lg bg-slate-700/60 hover:bg-red-500/20 hover:text-red-300 text-slate-400 flex items-center justify-center shrink-0 transition-colors" title="Delete">×</button>
        </div>
      ))}
      <button onClick={() => onAdd(field)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
        <Plus className="w-3 h-3" />Add {field === 'task' ? 'step' : 'guardrail'}
      </button>
    </div>
  )
}

function InstructionSpecSections({
  meta, view, editing, onSetField, onUpdateList, onAddItem, onRemoveItem,
}: {
  meta: NodeMeta; view: EditableInstruction; editing: boolean
  onSetField: (p: Partial<EditableInstruction>) => void
  onUpdateList: (f: 'task' | 'guardrails', i: number, v: string) => void
  onAddItem: (f: 'task' | 'guardrails') => void; onRemoveItem: (f: 'task' | 'guardrails', i: number) => void
}) {
  return (
    <>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Inputs</p>
        <div className="flex flex-wrap gap-2">
          {meta.inputs.map(i => <span key={i} className="font-mono text-xs px-2 py-1 rounded bg-slate-900/60 border border-slate-700/50 text-emerald-400">{i}</span>)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{meta.deterministic ? 'Deterministic Checks' : 'Task'}</p>
        {editing ? (
          <EditableList items={view.task} field="task" onUpdate={onUpdateList} onAdd={onAddItem} onRemove={onRemoveItem} />
        ) : (
          <ul className="space-y-1.5">
            {view.task.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <span className="text-slate-600 mt-0.5 shrink-0">{i + 1}.</span><span>{t}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Output Contract</p>
        {editing ? (
          <input value={view.output} onChange={e => onSetField({ output: e.target.value })} className="w-full font-mono text-xs px-3.5 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-300 focus:outline-none focus:border-slate-500" />
        ) : (
          <div className="font-mono text-xs px-3.5 py-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 text-slate-300">{view.output}</div>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Guardrails · What NOT to do</p>
        {editing ? (
          <EditableList items={view.guardrails} field="guardrails" onUpdate={onUpdateList} onAdd={onAddItem} onRemove={onRemoveItem} />
        ) : (
          <ul className="space-y-1.5">
            {view.guardrails.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                <Shield className="w-3 h-3 text-amber-400/80 mt-0.5 shrink-0" /><span>{g}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function InstructionEditor({
  nodeId, store, proposedDraft, clusterCases, onEditingChange, onPromoted,
}: {
  nodeId: string; store: InstructionStore; proposedDraft?: EditableInstruction; clusterCases?: number
  onEditingChange?: (editing: boolean) => void; onPromoted?: (version: number) => void
}) {
  const meta = NODE_META.find(n => n.id === nodeId)!
  const editable = isNodeEditable(meta)
  const versions = store.historyById[nodeId]
  const latest = versions[versions.length - 1]
  const current = latest.snapshot
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<EditableInstruction | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [justPublished, setJustPublished] = useState<number | null>(null)
  const [fromProposed, setFromProposed] = useState(false)

  const view = editing && draft ? draft : current
  const deltas = editing && draft ? computeInstructionDeltas(current, draft) : []
  const setEdit = (b: boolean) => { setEditing(b); onEditingChange?.(b) }
  const startEdit = (seed?: EditableInstruction) => {
    setDraft(JSON.parse(JSON.stringify(seed ?? current)))
    setFromProposed(!!seed); setEdit(true); setChangeNote(''); setJustPublished(null); setShowHistory(false)
  }
  const updateList = (f: 'task' | 'guardrails', i: number, v: string) =>
    setDraft(d => d ? { ...d, [f]: d[f].map((x, j) => j === i ? v : x) } : d)
  const promote = (res: DimResult[]) => {
    if (!draft || !changeNote.trim()) return
    const v = store.promote(nodeId, draft, changeNote.trim(), deltas, res)
    setEdit(false); setDraft(null); setJustPublished(v); onPromoted?.(v)
  }

  return (
    <div className="space-y-6">
      {justPublished !== null && !editing && <JustPublishedBanner version={justPublished} scope="Live across all deployments using this node." />}
      {proposedDraft && !editing && (
        <div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => startEdit(proposedDraft)} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Zap className="w-4 h-4 shrink-0" />Apply proposed fix
            </button>
            <button onClick={() => startEdit()} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium border border-slate-600 transition-colors">
              <Pencil className="w-4 h-4 shrink-0" />Fix manually
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">Apply the AI-proposed fix, or edit the {meta.node} instruction manually — sandbox + regression gated.</p>
        </div>
      )}
      <div className={`bg-slate-800/40 border rounded-xl p-6 space-y-5 ${editing ? 'border-violet-500/40' : 'border-slate-700/60'}`}>
        <div>
          <div className="flex items-center gap-2 mb-3">
            {meta.deterministic && <span className="text-xs font-medium px-2 py-1 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 whitespace-nowrap">Deterministic · no LLM</span>}
            <div className="ml-auto">
              <ArtifactControls version={latest.version} editing={editing} onToggleHistory={() => setShowHistory(s => !s)} onEdit={() => startEdit()} editable={editable} />
            </div>
          </div>
          {editing ? (
            <textarea value={view.role} onChange={e => setDraft(d => d ? { ...d, role: e.target.value } : d)} rows={2} className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-200 resize-y focus:outline-none focus:border-slate-500" />
          ) : (
            <p className="text-sm text-slate-200 leading-relaxed">{view.role}</p>
          )}
          {!editable && (
            <p className="text-xs text-sky-300 leading-relaxed mt-2 flex items-start gap-1.5">
              <Lock className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Defined in code, not an editable prompt — deterministic validator the model cannot rewrite (<span className="font-mono">ADR-0003</span>).</span>
            </p>
          )}
        </div>
        <InstructionSpecSections
          meta={meta} view={view} editing={editing} onSetField={p => setDraft(d => d ? { ...d, ...p } : d)}
          onUpdateList={updateList} onAddItem={f => setDraft(d => d ? { ...d, [f]: [...d[f], ''] } : d)}
          onRemoveItem={(f, i) => setDraft(d => d ? { ...d, [f]: d[f].filter((_, j) => j !== i) } : d)}
        />
      </div>
      {editing && (
        <SandboxPromotionBar
          deltas={deltas} changeNote={changeNote} setChangeNote={setChangeNote} onPromote={promote}
          onDiscard={res => { if (res) store.discardExperiment(nodeId, changeNote.trim(), res); setEdit(false); setDraft(null) }}
          clusterCases={clusterCases} aiProposed={fromProposed}
        />
      )}
      {showHistory && (
        <VersionHistoryPanel
          title={meta.node} versions={versions} latestVersion={latest.version} editing={editing}
          onRevert={v => { const nv = store.revertTo(nodeId, v); if (nv) setJustPublished(nv) }}
          experiments={store.experimentsById[nodeId] ?? []}
        />
      )}
    </div>
  )
}
