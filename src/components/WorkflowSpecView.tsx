import { useState } from 'react'
import { Package, Terminal } from 'lucide-react'
import { IllustrativeTag, RoleChip } from './ui'
import { ARTIFACT_ACTOR, ARTIFACT_TODAY, ArtifactControls, type DimResult, type Experiment, JustPublishedBanner, SandboxPromotionBar, type VersionEntry, VersionHistoryPanel } from './versioning'
import { computeWorkflowDeltas, WORKFLOW_HISTORY_BY_PACK, WORKFLOW_PACKS, type WorkflowSpecData } from './workflowSpecData'
import { CaseHandlingSection, MarketBadge, PolicyExtractionSection } from './WorkflowSpecSections'

export {
  computeWorkflowDeltas, WORKFLOW_HISTORY_BY_PACK, WORKFLOW_PACKS, WSPEC_ESOMEPRAZOLE,
  WSPEC_HUMIRA, WSPEC_LIVDELZI, WSPEC_OZEMPIC, type WorkflowPack, type WorkflowSpecData,
} from './workflowSpecData'
export { MarketBadge } from './WorkflowSpecSections'

export function WorkflowSpecView({ onInspectScenario }: { onInspectScenario?: (scenarioId: string) => void } = {}) {
  const [packId, setPackId] = useState('ozempic-cigna')
  const [historyById, setHistoryById] = useState<Record<string, VersionEntry<WorkflowSpecData>[]>>(WORKFLOW_HISTORY_BY_PACK)
  const [experimentsById, setExperimentsById] = useState<Record<string, Experiment[]>>({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WorkflowSpecData | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [justPublished, setJustPublished] = useState<number | null>(null)

  const pack = WORKFLOW_PACKS.find(p => p.id === packId)!
  const versions = historyById[packId]
  const experiments = experimentsById[packId] ?? []
  const latest = versions[versions.length - 1]
  const current = latest.snapshot
  const data = editing && draft ? draft : current
  const deltas = editing && draft ? computeWorkflowDeltas(current, draft) : []
  const expId = () => `exp-${String(experiments.length + 1).padStart(2, '0')}`
  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(current))); setEditing(true); setChangeNote(''); setJustPublished(null); setShowHistory(false) }

  const promote = (results: DimResult[]) => {
    if (!draft || !changeNote.trim()) return
    const note = changeNote.trim()
    setHistoryById(h => ({ ...h, [packId]: [...h[packId], { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note, deltas, snapshot: draft }] }))
    setExperimentsById(e => ({ ...e, [packId]: [...(e[packId] ?? []), { id: expId(), timestamp: ARTIFACT_TODAY, note, verdict: 'promoted', results }] }))
    setEditing(false); setDraft(null); setJustPublished(latest.version + 1)
  }

  const revertTo = (v: number) => {
    const snap = versions.find(x => x.version === v)!.snapshot
    const computed = computeWorkflowDeltas(current, snap)
    if (computed[0] === 'No changes') return
    setHistoryById(h => ({ ...h, [packId]: [...h[packId], { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note: `Reverted to v${v}`, deltas: computed, snapshot: JSON.parse(JSON.stringify(snap)) }] }))
    setJustPublished(latest.version + 1)
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Workflow Spec</h1>
          <p className="text-sm text-slate-400 mt-0.5">One spec per drug × payer policy pack. Verified rules are eval-gated before propagating to production.</p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>

      <div className="px-8 py-6 space-y-8">
        <div className="flex items-center gap-2 flex-wrap">
          {WORKFLOW_PACKS.map(p => {
            const active = p.id === packId
            return (
              <button
                key={p.id} onClick={() => { if (!editing) setPackId(p.id) }} disabled={editing && !active}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm' : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Package className="w-3.5 h-3.5" />{p.drug.split(' ')[0]}
              </button>
            )
          })}
          {editing && <span className="text-xs text-slate-500 ml-1">Finish or cancel your draft to switch packs</span>}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-sm min-w-0 flex-wrap">
            <span className="text-white font-medium">{pack.drug}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{pack.carrier}</span>
            <MarketBadge market={pack.market} />
            <span className="text-xs font-mono text-emerald-400 ml-1">{pack.file}</span>
          </div>
          <div className="flex items-center gap-2">
            {onInspectScenario && (
              <button
                type="button" onClick={() => onInspectScenario(pack.scenarioId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />Inspect Pack in 3-Column Trace →
              </button>
            )}
            <ArtifactControls version={latest.version} editing={editing} onToggleHistory={() => setShowHistory(s => !s)} onEdit={startEdit} />
          </div>
        </div>

        {justPublished !== null && !editing && <JustPublishedBanner version={justPublished} scope="The updated spec is live for this policy pack." />}
        <PolicyExtractionSection pack={pack} data={data} editing={editing} onSetRules={rules => setDraft(d => d ? { ...d, rules } : d)} />
        <CaseHandlingSection data={data} editing={editing} onPatch={patch => setDraft(d => d ? { ...d, ...patch } : d)} />
        {editing && (
          <SandboxPromotionBar
            deltas={deltas} changeNote={changeNote} setChangeNote={setChangeNote} onPromote={promote}
            onDiscard={res => { if (res) setExperimentsById(e => ({ ...e, [packId]: [...(e[packId] ?? []), { id: expId(), timestamp: ARTIFACT_TODAY, note: changeNote.trim() || '(no note)', verdict: 'discarded', results: res }] })); setEditing(false); setDraft(null) }}
          />
        )}
        {showHistory && <VersionHistoryPanel title={`${pack.drug.split(' ')[0]} Spec`} versions={versions} latestVersion={latest.version} editing={editing} onRevert={revertTo} experiments={experiments} />}
      </div>
    </div>
  )
}
