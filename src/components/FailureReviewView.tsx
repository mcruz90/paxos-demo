import { useState } from 'react'
import { CheckCircle, ChevronRight, AlertTriangle, Search, ChevronLeft, Info, GitBranch, Pencil } from 'lucide-react'
import { type View } from '../types'
import { IllustrativeTag, RoleChip } from './ui'
import { type EditableInstruction, INSTR_GATEKEEPER, INSTR_RETRIEVAL, INSTR_SYNTHESIS_V2, InstructionEditor, type InstructionStore, NODE_META } from './instructions'

export interface FailureCluster {
  id: string
  mode: string
  failureClass: string
  count: number
  trend: 'up' | 'flat' | 'down'
  severity: 'critical' | 'high' | 'medium' | 'low'
  node: string
  rootCause: string
  proposedFix: string
  proposedDraft: EditableInstruction
  sampleCases: { id: string; drug: string; symptom: string }[]
}

// Proposed-fix drafts (pre-fill the in-context editor for each cluster's implicated node)
export const FIX_SYNTHESIS_OVERCAUTION: EditableInstruction = INSTR_SYNTHESIS_V2
export const FIX_GATEKEEPER_SAFETY: EditableInstruction = {
  ...INSTR_GATEKEEPER,
  task: [...INSTR_GATEKEEPER.task, 'Reject any safety-critical criterion that was satisfied by inference rather than explicit evidence.'],
}
export const FIX_RETRIEVAL_GROUNDING: EditableInstruction = {
  ...INSTR_RETRIEVAL,
  guardrails: [...INSTR_RETRIEVAL.guardrails, 'On long records, cap evidence spans and re-verify each citation resolves to its cited source.'],
}
export const FIX_RETRIEVAL_CONFLICT: EditableInstruction = {
  ...INSTR_RETRIEVAL,
  guardrails: [...INSTR_RETRIEVAL.guardrails, 'When two sources make contradictory claims about the same criterion, surface both and mark the criterion conflicted — never resolve the contradiction silently.'],
}

export const FAILURE_CLUSTERS: FailureCluster[] = [
  {
    id: 'cl-safety', mode: 'Safety clearance by inference', failureClass: 'safety', count: 3, trend: 'flat', severity: 'critical', node: 'gatekeeper',
    rootCause: 'The gatekeeper does not explicitly reject a safety-critical criterion that synthesis satisfied by inference rather than explicit evidence — so a contraindication could clear on weak grounds.',
    proposedFix: 'Add a deterministic gatekeeper check: reject any safety-critical criterion not backed by explicit evidence.',
    proposedDraft: FIX_GATEKEEPER_SAFETY,
    sampleCases: [
      { id: 'PH-5567', drug: 'Livdelzi', symptom: 'Decompensation flag inferred from ambiguous chart note, not explicitly documented' },
      { id: 'PH-5571', drug: 'Ozempic', symptom: 'No concomitant GLP-1 not explicitly cleared in chart — absence inferred from incomplete med list, passed gate' },
      { id: 'PH-5588', drug: 'Livdelzi', symptom: 'Decompensation flag inferred, not explicitly documented' },
    ],
  },
  {
    id: 'cl-overcaution', mode: 'Over-cautious escalation', failureClass: 'over-caution', count: 50, trend: 'up', severity: 'high', node: 'synthesis',
    rootCause: 'Synthesis escalates any criterion whose evidence is not stated outright — it cannot treat reliably-derivable evidence (e.g. trial duration from pharmacy refill records) as satisfied, so clean cases bounce to a full human review.',
    proposedFix: 'Adopt the evidence-sufficiency policy: a supporting criterion may be satisfied by explicit statement OR well-supported inference (recording the basis); never infer a safety-critical clearance.',
    proposedDraft: FIX_SYNTHESIS_OVERCAUTION,
    sampleCases: [
      { id: 'PH-3102', drug: 'Ozempic', symptom: 'Patient age derivable from DOB in referral header, flagged needs_review' },
      { id: 'PH-3140', drug: 'Ozempic', symptom: 'T2DM diagnosis derivable from ICD code + labs in chart, flagged needs_review' },
      { id: 'PH-3199', drug: 'Mounjaro', symptom: 'Step therapy derivable from claims history, escalated' },
    ],
  },
  {
    id: 'cl-grounding', mode: 'Citation drift (long drafts)', failureClass: 'grounding', count: 1, trend: 'flat', severity: 'low', node: 'retrieval',
    rootCause: 'On long records, a claim occasionally traces only loosely to its cited source — the provenance span is too broad.',
    proposedFix: 'Tighten retrieval: cap evidence spans on long records and re-verify each citation resolves to its source.',
    proposedDraft: FIX_RETRIEVAL_GROUNDING,
    sampleCases: [
      { id: 'PH-4810', drug: 'Esomeprazole Susp.', symptom: 'Citation span covers a full page; exact line ambiguous' },
    ],
  },
  {
    id: 'cl-conflict', mode: 'Conflicting source evidence', failureClass: 'grounding', count: 4, trend: 'flat', severity: 'high', node: 'retrieval',
    rootCause: 'When two source documents make contradictory claims about the same criterion (e.g. a consult notes “no decompensation” while a discharge summary documents an ascites episode), the pipeline could take the first-found span and proceed — masking a real clinical contradiction the coordinator needs to adjudicate.',
    proposedFix: 'On contradictory spans for one criterion, surface both sources and mark the criterion conflicted; route to human adjudication rather than silently selecting one. Missing evidence and contradictory evidence are handled as distinct states.',
    proposedDraft: FIX_RETRIEVAL_CONFLICT,
    sampleCases: [
      { id: 'PH-2847', drug: 'Livdelzi', symptom: 'Consult says no decompensation; discharge summary documents ascites' },
      { id: 'PH-6012', drug: 'Humira', symptom: 'Two notes disagree on prior biologic trial duration' },
      { id: 'PH-6048', drug: 'Enbrel', symptom: 'Weight differs between intake and pharmacy record — changes dose math' },
    ],
  },
]

export const SEVERITY_RANK: Record<FailureCluster['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 }
export const SEVERITY_CLS: Record<FailureCluster['severity'], string> = {
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
  high: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  medium: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  low: 'text-slate-400 bg-slate-700/40 border-slate-600/30',
}

export function FailureReviewView({ setView, store }: { setView: (v: View) => void; store: InstructionStore }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Record<string, number>>({})
  const ordered = [...FAILURE_CLUSTERS].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count)
  const selected = FAILURE_CLUSTERS.find(c => c.id === selectedId) ?? null
  const totalFailures = FAILURE_CLUSTERS.reduce((n, c) => n + c.count, 0)
  const openClusters = FAILURE_CLUSTERS.filter(c => !resolved[c.id]).length
  const trendGlyph: Record<string, string> = { up: '↑', flat: '→', down: '↓' }
  const trendCls: Record<string, string> = { up: 'text-red-400', flat: 'text-slate-500', down: 'text-emerald-400' }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">{selected ? 'Failure Cluster' : 'Prod Health'}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {selected
              ? 'Investigate the failure mode, then remediate it once — for the whole cluster'
              : 'Failures sampled from production, grouped by mode and prioritized — remediate at the cluster level, not case-by-case'}
          </p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>

      <div className="px-8 py-6 space-y-8">

        {!selected ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Failure Rate (7d)', value: '2.1%', sub: 'of processed cases' },
                { label: 'Failures (7d)', value: `${totalFailures}`, sub: 'across the suite' },
                { label: 'Failure Modes', value: `${FAILURE_CLUSTERS.length}`, sub: 'distinct clusters' },
                { label: 'Open Clusters', value: `${openClusters}`, sub: 'awaiting remediation' },
              ].map(m => (
                <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
                  <p className="text-2xl font-bold font-mono text-slate-100 leading-none">{m.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{m.sub}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Failure Clusters</h2>
                <p className="text-xs text-slate-500">Prioritized by severity × volume — 3 safety failures outrank 50 over-cautious ones</p>
              </div>
              <span className="text-xs text-slate-500">Last sampled from prod · Jun 15, 2026</span>
            </div>

            <div className="space-y-2">
              {ordered.map(c => {
                const isResolved = !!resolved[c.id]
                const node = NODE_META.find(n => n.id === c.node)!
                return (
                  <button key={c.id} onClick={() => setSelectedId(c.id)} className="w-full flex items-center gap-4 px-4 py-3.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-left hover:border-slate-600 transition-colors">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 w-16 text-center ${SEVERITY_CLS[c.severity]}`}>{c.severity}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{c.mode} <span className="text-slate-600 font-normal">· {c.failureClass}</span></p>
                      <p className="text-xs text-slate-500 mt-0.5">implicates <span className="font-mono text-slate-400">{node.node}</span> instruction</p>
                    </div>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-lg font-bold font-mono text-slate-200">{c.count}</span>
                      <span className={`text-sm ${trendCls[c.trend]}`}>{trendGlyph[c.trend]}</span>
                    </div>
                    {isResolved
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/20 shrink-0">resolved</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full border text-slate-400 bg-slate-700/40 border-slate-600/30 shrink-0">open</span>}
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                )
              })}
            </div>

            <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-400 leading-relaxed">
                Failures are sampled continuously from production runs and QA review, then auto-grouped by mode. You fix the <span className="text-slate-300 font-medium">cluster</span>,
                not the case — one bounded instruction change resolves every case sharing that failure mode, validated in a sandbox before it reaches prod.
              </p>
            </div>
          </>
        ) : (() => {
          const node = NODE_META.find(n => n.id === selected.node)!
          const resolvedV = resolved[selected.id]
          return (
            <>
              <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
                <ChevronLeft className="w-3.5 h-3.5" />All clusters
              </button>

              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${SEVERITY_CLS[selected.severity]}`}>{selected.severity}</span>
                <h2 className="text-lg font-bold text-white">{selected.mode}</h2>
                <span className="text-sm text-slate-500">·</span>
                <span className="text-sm text-slate-400"><span className="font-mono text-slate-200">{selected.count}</span> cases <span className={trendCls[selected.trend]}>{trendGlyph[selected.trend]}</span></span>
                <span className="text-sm text-slate-500">·</span>
                <span className="text-sm text-slate-400">implicates <span className="font-mono text-slate-300">{node.node}</span></span>
              </div>

              {resolvedV && (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-sm text-emerald-300 flex-1">Cluster resolved — all {selected.count} cases cleared by <span className="font-mono">{node.node} v{resolvedV}</span>. A regression eval case was added so it can&rsquo;t silently return.</p>
                  <button onClick={() => setView('rubric')} className="text-xs text-emerald-300 hover:text-emerald-200 underline shrink-0">View regression eval →</button>
                </div>
              )}

              {/* Root cause */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center"><Search className="w-3.5 h-3.5 text-sky-400" /></div>
                  <h2 className="text-sm font-semibold text-white">Root-Cause Diagnosis</h2>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
                  <p className="text-sm text-slate-300 leading-relaxed">{selected.rootCause}</p>
                </div>
              </div>

              {/* Sample cases */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /></div>
                  <h2 className="text-sm font-semibold text-white">Representative Cases <span className="text-slate-500 font-normal">· {selected.sampleCases.length} of {selected.count}</span></h2>
                </div>
                <div className="space-y-2">
                  {selected.sampleCases.map(sc => (
                    <div key={sc.id} className="flex items-start gap-3 px-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                      <span className="font-mono text-xs text-slate-400 shrink-0 pt-0.5 w-20">{sc.id}</span>
                      <span className="text-xs text-slate-300 shrink-0 w-28">{sc.drug}</span>
                      <span className="text-xs text-slate-500 flex-1">{sc.symptom}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.id === 'cl-overcaution' && (
                <>
                  <div className="flex items-start gap-3 px-4 py-3 bg-emerald-950/20 border border-emerald-500/25 rounded-xl">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed"><span className="font-mono text-slate-300">PH-3102 (Ozempic)</span> is the routine &ldquo;approve in 3 minutes&rdquo; case coordinators see in the queue. Before this fix it <span className="text-amber-300">over-escalated</span> to full review because the Metformin duration was only derivable from refill records. The evidence-sufficiency fix is what turned it into the clean routine approval — and its regression case (<span className="font-mono text-slate-300">ozempic-derivable-duration</span>) now pins that behavior in the eval suite so it can&rsquo;t silently regress.</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">A prior attempt to fix this cluster relaxed over-caution too aggressively and the sandbox <span className="text-red-300">blocked it</span> for regressing citation alignment (97%→91%). See the Experiment Log under History below. The proposed fix here is the bounded version.</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-400 leading-relaxed">Suite-level over-caution currently sits at <span className="font-mono text-slate-300">4%</span> — within the <span className="font-mono text-slate-300">≤5%</span> eval bar, but <span className="text-amber-300">trending up</span>. The <span className="font-mono text-slate-300">{selected.count}</span> here is the 7-day case volume this mode produced; the bounded fix targets <span className="font-mono text-slate-300">2%</span> to keep it clear of the threshold.</p>
                  </div>
                </>
              )}

              {/* Remediation */}
              <div>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/30 flex items-center justify-center"><Pencil className="w-3.5 h-3.5 text-violet-400" /></div>
                  <h2 className="text-sm font-semibold text-white">Remediate the Cluster</h2>
                </div>
                <div className="flex items-start gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl mb-3">
                  <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <span className="text-slate-300 font-medium">Proposed fix:</span> {selected.proposedFix} One promotion fixes all {selected.count} cases — the sandbox validates against the cluster&rsquo;s cases <span className="text-slate-300">and</span> the full regression suite, then ships via a <span className="text-slate-300">staged canary rollout</span> with auto-rollback — never a fleet-wide flip from one offline pass. Editing here writes to the same <span className="font-mono text-slate-300">{node.node}</span> instruction as the Agent Instructions tab — one source of truth.
                  </p>
                </div>
                <div className="flex items-start gap-2 px-4 py-3 bg-slate-800/30 border border-slate-700/40 rounded-xl mb-3">
                  <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Root cause in a payer-policy rule instead — a wrong threshold or <span className="font-mono text-slate-300">&gt;</span> vs <span className="font-mono text-slate-300">≥</span>? Correct it on the affected pack in the <button onClick={() => setView('specs')} className="text-emerald-400 hover:underline">Workflow Spec</button>, on the same versioned, eval-gated path. That closes the case → cluster → pack feedback loop.
                  </p>
                </div>
                <InstructionEditor
                  key={selected.id}
                  nodeId={selected.node}
                  store={store}
                  proposedDraft={resolvedV ? undefined : selected.proposedDraft}
                  clusterCases={selected.count}
                  onPromoted={v => setResolved(r => ({ ...r, [selected.id]: v }))}
                />
              </div>
            </>
          )
        })()}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
