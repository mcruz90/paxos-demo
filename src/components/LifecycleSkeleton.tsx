import { ArrowDown, ArrowUp, ArrowRight, Plus, ShieldCheck, GitBranch, RefreshCw } from 'lucide-react'
import { IllustrativeTag } from './ui'
import {
  ArtifactControls, ARTIFACT_ACTOR, diffList, EditableRecordList, JustPublishedBanner,
  SandboxPromotionBar, useVersioned, type VersionEntry, VersionHistoryPanel,
} from './versioning'

// The full PA lifecycle, as a stage graph. Replaces the appeals-only "Appeal
// Skeleton": a case now runs order → coverage discovery → documentation →
// assembly → gatekeeper → submission → determination, with appeals as one branch.
// Each stage carries entry GATES (preconditions that must hold to advance), the
// SCHEMA it produces/consumes, and an optional artifact. Editable + versioned —
// every change rides the sandbox → eval-gate → staged-rollout path before prod.

export interface LifecycleStage {
  key: string
  name: string
  node: string          // pipeline node: Intake | Retrieval | Synthesis | Gatekeeper | Transmit | Determination | Routing
  role: string
  gates: string[]       // entry preconditions — all must hold to advance
  fields: { name: string; type: string }[]
  artifact?: string     // artifact this stage produces, if any
  branch?: string       // branch annotation (e.g. determination outcomes)
  loopsTo?: string      // stage this loops back to (e.g. appeal → assembly)
}
export interface LifecycleSkeletonData { stages: LifecycleStage[] }

export const NODES = ['Intake', 'Retrieval', 'Synthesis', 'Gatekeeper', 'Transmit', 'Determination', 'Routing']

// Display-only grouping of stages into lifecycle phases (not part of the
// versioned schema — keeps the read-mode diagram hierarchical without touching
// the editable data). Stages not listed fall back to their own group.
const PHASE_BY_KEY: Record<string, string> = {
  intake: 'Establish need',      coverage: 'Establish need',
  documentation: 'Build the case', assembly: 'Build the case',
  gatekeeper: 'Validate & submit', submission: 'Validate & submit',
  determination: 'Resolve',       appeal: 'Resolve',
}

const NODE_CLS: Record<string, string> = {
  Intake:        'text-slate-300 bg-slate-700/40 border-slate-600/40',
  Retrieval:     'text-sky-300 bg-sky-500/10 border-sky-500/20',
  Synthesis:     'text-violet-300 bg-violet-500/10 border-violet-500/20',
  Gatekeeper:    'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Transmit:      'text-blue-300 bg-blue-500/10 border-blue-500/20',
  Determination: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  Routing:       'text-red-300 bg-red-500/10 border-red-500/20',
}

export const LIFECYCLE_SKELETON_V1: LifecycleSkeletonData = {
  stages: [
    {
      key: 'intake', name: 'Order Intake', node: 'Intake',
      role: 'A new order/Rx — or an inbound payer denial, for the appeal path — arrives from the connected record. The trigger that opens a case.',
      gates: [],
      fields: [
        { name: 'order', type: 'NDC | HCPCS' },
        { name: 'patient / plan / member', type: 'str' },
        { name: 'source', type: 'Literal["ehr_fhir","crm","fax"]' },
        { name: 'inbound_denial?', type: 'DenialEvent | None' },
      ],
    },
    {
      key: 'coverage', name: 'Coverage Discovery', node: 'Retrieval',
      role: 'Da Vinci CRD — is a prior authorization required for this drug × plan, and which policy pack governs it? Resolves the pack on BIN/PCN/Group.',
      gates: ['A PA is required for this drug × plan — otherwise auto-approve and close'],
      fields: [
        { name: 'pa_required', type: 'bool | null' },
        { name: 'resolved_pack', type: 'PolicyPack' },
        { name: 'bin / pcn / group', type: 'str' },
        { name: 'effective_dates', type: 'DateRange' },
      ],
    },
    {
      key: 'documentation', name: 'Documentation', node: 'Retrieval',
      role: 'Da Vinci DTR — pull the payer-required documentation from the chart and auto-answer the questionnaire, binding every answer to a source.',
      gates: ['Every required criterion has supporting evidence — otherwise escalate to Exception'],
      fields: [
        { name: 'criterion_results[]', type: 'CriterionResult' },
        { name: 'questionnaire_answers[]', type: 'Answer' },
        { name: 'provenance', type: 'Citation' },
      ],
    },
    {
      key: 'assembly', name: 'Assembly', node: 'Synthesis',
      role: 'Assemble the structured PA request — or the appeal argument — from the criteria plus external supporting sources. Every claim is cited.',
      gates: [],
      artifact: 'prior_auth | appeal | counter_argument',
      fields: [
        { name: 'body', type: 'str' },
        { name: 'cited_claims[]', type: 'ClaimCitation' },
        { name: 'supporting_sources[]', type: 'Citation' },
      ],
    },
    {
      key: 'gatekeeper', name: 'Gatekeeper', node: 'Gatekeeper',
      role: 'Deterministic validation of the payload — no LLM. Drug/diagnosis present, every claim cited, payload well-formed.',
      gates: ['All deterministic checks pass — otherwise retry, then escalate to Exception'],
      fields: [
        { name: 'checks[]', type: 'GateCheck' },
        { name: 'passed', type: 'bool' },
      ],
    },
    {
      key: 'submission', name: 'Submission', node: 'Transmit',
      role: 'A human authorizes, then the case transmits — initial PAs over Da Vinci PAS (X12 278), appeals over the payer’s appeal channel.',
      gates: ['Human authorization — nothing transmits to the payer until a person approves'],
      fields: [
        { name: 'channel', type: 'Literal["pas","appeal_channel","fax"]' },
        { name: 'submitted_by', type: 'str' },
        { name: 'reference', type: 'str' },
      ],
    },
    {
      key: 'determination', name: 'Determination', node: 'Determination',
      role: 'The payer’s decision returns and is recorded against the case.',
      gates: [],
      branch: 'Approved → therapy · Pended → info request · Denied → Appeal',
      artifact: 'determination',
      fields: [
        { name: 'decision', type: 'Literal["approved","pended","denied"]' },
        { name: 'determination_id', type: 'str' },
        { name: 'time_to_therapy', type: 'duration' },
      ],
    },
    {
      key: 'appeal', name: 'Appeal', node: 'Routing',
      role: 'On a denial, escalate up the appeal ladder; the appeal argument is assembled and re-submitted on the same evidence.',
      gates: ['Within the appeal filing deadline — otherwise the window closes and the case is lost'],
      branch: 'internal L1 → L2 → peer-to-peer → external IRO → state DOI',
      loopsTo: 'Assembly',
      fields: [
        { name: 'level', type: 'Literal["internal_l1","internal_l2","peer_to_peer","external_iro","state_doi"]' },
        { name: 'deadline', type: 'date' },
        { name: 'decision_maker', type: 'str' },
      ],
    },
  ],
}

export const LIFECYCLE_HISTORY: VersionEntry<LifecycleSkeletonData>[] = [
  { version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial full-lifecycle skeleton', deltas: ['Initial version'], snapshot: LIFECYCLE_SKELETON_V1 },
]

export function computeSkeletonDeltas(prev: LifecycleSkeletonData, next: LifecycleSkeletonData): string[] {
  const d = diffList(prev.stages, next.stages, 'stage', s => s.name || '(unnamed)')
  return d.length ? d : ['No changes']
}

// Minimal string-list editor for a stage's entry gates.
function EditableStringList({ items, onChange, addLabel, placeholder }: {
  items: string[]; onChange: (items: string[]) => void; addLabel: string; placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={it}
            onChange={e => onChange(items.map((x, j) => j === i ? e.target.value : x))}
            placeholder={placeholder}
            className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500"
          />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="w-6 h-6 rounded-md bg-slate-700/60 hover:bg-red-500/20 hover:text-red-300 text-slate-400 flex items-center justify-center shrink-0 transition-colors" title="Remove gate">×</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ''])} className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"><Plus className="w-3 h-3" />{addLabel}</button>
    </div>
  )
}

// Compact stage node for the read-mode diagram.
function StageCard({ s }: { s: LifecycleStage }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 flex flex-col">
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${NODE_CLS[s.node] ?? NODE_CLS.Intake}`}>{s.node}</span>
        <p className="text-sm font-semibold text-white leading-tight">{s.name}</p>
      </div>
      {s.artifact && <span className="self-start text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-mono mb-1.5">→ {s.artifact}</span>}
      <p className="text-[11px] text-slate-400 leading-relaxed">{s.role}</p>
      {s.gates.map((g, gi) => (
        <div key={gi} className="flex items-start gap-1.5 px-2 py-1 mt-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
          <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
          <span className="text-[10px] text-amber-300 leading-snug"><span className="font-semibold">Gate · </span>{g}</span>
        </div>
      ))}
      {s.branch && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {s.branch.split('·').map((b, bi) => (
            <span key={bi} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-900/50 border border-slate-700/50 text-slate-400"><GitBranch className="w-2.5 h-2.5 shrink-0" />{b.trim()}</span>
          ))}
        </div>
      )}
      {s.loopsTo && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-violet-300"><RefreshCw className="w-3 h-3 shrink-0" />loops back to {s.loopsTo}</div>
      )}
      <div className="mt-2 pt-2 border-t border-slate-700/40 font-mono text-[10px] space-y-0.5">
        {s.fields.map(f => (
          <p key={f.name} className="break-all"><span className="text-sky-300">{f.name}</span><span className="text-slate-600">: </span><span className="text-slate-400">{f.type}</span></p>
        ))}
      </div>
    </div>
  )
}

export function LifecycleSkeleton() {
  const {
    versions, experiments, editing, draft, setDraft, changeNote, setChangeNote,
    showHistory, setShowHistory, justPublished, latest, current, startEdit, promote, discardExperiment, revertTo,
  } = useVersioned<LifecycleSkeletonData>(LIFECYCLE_HISTORY)
  const data = editing && draft ? draft : current
  const deltas = editing && draft ? computeSkeletonDeltas(current, draft) : []

  // Group stages into lifecycle phases for the read-mode diagram (display-only).
  const phases: { label: string; stages: LifecycleStage[] }[] = []
  for (const s of data.stages) {
    const label = PHASE_BY_KEY[s.key] ?? s.name
    const last = phases[phases.length - 1]
    if (PHASE_BY_KEY[s.key] && last && last.label === label) last.stages.push(s)
    else phases.push({ label, stages: [s] })
  }

  const setStages = (stages: LifecycleStage[]) => setDraft(d => d ? { ...d, stages } : d)
  const updateStage = (i: number, patch: Partial<LifecycleStage>) => setStages(data.stages.map((s, j) => j === i ? { ...s, ...patch } : s))
  const moveStage = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= data.stages.length) return
    const next = [...data.stages]; [next[i], next[j]] = [next[j], next[i]]; setStages(next)
  }
  const removeStage = (i: number) => setStages(data.stages.filter((_, j) => j !== i))
  const addStage = () => setStages([...data.stages, { key: `stage-${Date.now()}`, name: '', node: 'Intake', role: '', gates: [], fields: [] }])

  return (
    <div id="tour-skeleton">
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-white">PA Case Skeleton</h2>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            The full prior-authorization lifecycle every case runs through — each stage depends on the one before it, with <span className="text-amber-300/90">gates</span> that must hold to advance and a branch at determination (approved · pended · denied → appeal). Editing is eval-gated and versioned.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <IllustrativeTag />
          <ArtifactControls version={latest.version} editing={editing} onToggleHistory={() => setShowHistory(s => !s)} onEdit={startEdit} />
        </div>
      </div>

      {justPublished !== null && !editing && <div className="my-3"><JustPublishedBanner version={justPublished} scope="The updated lifecycle is live across every deployment." /></div>}

      {editing ? (
        /* ── Editor ──────────────────────────────────────────────────────── */
        <div className="space-y-3 mt-3">
          {data.stages.map((s, i) => {
            const phase = PHASE_BY_KEY[s.key]
            const showPhase = phase && phase !== (i > 0 ? PHASE_BY_KEY[data.stages[i - 1].key] : undefined)
            return (
            <div key={s.key}>
              {showPhase && <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{phase}</p>}
              <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 w-5 shrink-0">{i + 1}</span>
                <input value={s.name} onChange={e => updateStage(i, { name: e.target.value })} placeholder="stage name" className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-sm font-medium text-white focus:outline-none focus:border-slate-500" />
                <select value={s.node} onChange={e => updateStage(i, { node: e.target.value })} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-slate-500">
                  {NODES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="w-6 h-6 rounded-md bg-slate-700/60 hover:bg-slate-600 disabled:opacity-30 text-slate-300 flex items-center justify-center shrink-0" title="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => moveStage(i, 1)} disabled={i === data.stages.length - 1} className="w-6 h-6 rounded-md bg-slate-700/60 hover:bg-slate-600 disabled:opacity-30 text-slate-300 flex items-center justify-center shrink-0" title="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => removeStage(i)} className="w-6 h-6 rounded-md bg-slate-700/60 hover:bg-red-500/20 hover:text-red-300 text-slate-400 flex items-center justify-center shrink-0" title="Delete stage">×</button>
              </div>
              <textarea value={s.role} onChange={e => updateStage(i, { role: e.target.value })} rows={2} placeholder="what this stage does" className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500 resize-none" />
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Entry gates · all must hold to advance</label>
                <EditableStringList items={s.gates} onChange={gates => updateStage(i, { gates })} addLabel="Add gate" placeholder="a condition that must be true to proceed" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Schema fields</label>
                <EditableRecordList
                  items={s.fields}
                  onChange={fields => updateStage(i, { fields })}
                  addLabel="Add field"
                  blank={{ name: '', type: '' }}
                  fields={[{ key: 'name', placeholder: 'field', grow: 2 }, { key: 'type', placeholder: 'type', grow: 3 }]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Artifact produced (optional)</label>
                <input value={s.artifact ?? ''} onChange={e => updateStage(i, { artifact: e.target.value })} placeholder="e.g. prior_auth | appeal | determination" className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-slate-500" />
              </div>
              </div>
            </div>
            )
          })}
          <button onClick={addStage} className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"><Plus className="w-3.5 h-3.5" />Add stage</button>
        </div>
      ) : (
        /* ── Flowchart — lifecycle phases (left→right), each stacking its
             sub-stages (top→bottom). Two levels of hierarchy, fills the width. */
        <div className="mt-3 flex flex-col lg:flex-row lg:items-stretch gap-3 lg:gap-2">
          {phases.map((ph, pi) => (
            <div key={ph.label} className="contents">
              {/* Phase = a bounded group with a numbered header */}
              <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-center shrink-0">{pi + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider leading-none mb-0.5">Phase</p>
                    <p className="text-sm font-semibold text-white leading-tight truncate">{ph.label}</p>
                  </div>
                </div>
                <div className="flex flex-col flex-1">
                  {ph.stages.map((s, si) => (
                    <div key={s.key}>
                      <StageCard s={s} />
                      {si < ph.stages.length - 1 && (
                        <div className="flex justify-center py-1 text-slate-500"><ArrowDown className="w-4 h-4" /></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {pi < phases.length - 1 && (
                <div className="flex lg:flex-col items-center justify-center shrink-0 py-1 lg:py-0 lg:px-0.5 text-emerald-500/70">
                  <ArrowRight className="w-6 h-6 rotate-90 lg:rotate-0" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="mt-4">
          <SandboxPromotionBar deltas={deltas} changeNote={changeNote} setChangeNote={setChangeNote} onPromote={results => promote(deltas, results)} onDiscard={discardExperiment} />
        </div>
      )}

      {showHistory && (
        <div className="mt-4">
          <VersionHistoryPanel title="PA Case Skeleton" versions={versions} latestVersion={latest.version} editing={editing} onRevert={v => revertTo(v, computeSkeletonDeltas)} experiments={experiments} />
        </div>
      )}
    </div>
  )
}
