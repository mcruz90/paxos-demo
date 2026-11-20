import { useState } from 'react'
import { ArrowRight, Lock, Scale } from 'lucide-react'
import { InstructionEditor } from './InstructionEditor'
import { type InstructionStore, NODE_META } from './instructionsData'
import { NodeRunPanel } from './NodeRunPanel'
import { IllustrativeTag, RoleChip } from './ui'

export {
  computeInstructionDeltas, INITIAL_HISTORY, INSTR_GATEKEEPER, INSTR_INGESTION, INSTR_RETRIEVAL,
  INSTR_SYNTHESIS_V1, INSTR_SYNTHESIS_V2, INSTRUCTION_ACTOR, isNodeEditable, NODE_META,
  truncateDelta, useInstructionStore,
  type EditableInstruction, type InstructionStore, type InstructionVersion, type NodeMeta,
} from './instructionsData'
export { InstructionEditor } from './InstructionEditor'

function PrincipleCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="flex items-start gap-3 px-4 py-3.5 bg-violet-500/[0.06] border border-violet-500/25 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0"><Scale className="w-4 h-4 text-violet-300" /></div>
        <div>
          <p className="text-sm font-semibold text-violet-300">Core principle · Evidence Sufficiency</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            A <span className="text-slate-300">supporting</span> criterion may be satisfied by an explicit statement <span className="text-slate-300">or</span> a well-supported inference with recorded basis. A <span className="text-slate-300">safety-critical</span> criterion is <span className="text-amber-300 font-semibold">never</span> inferred; it requires explicit evidence or escalates.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 px-4 py-3.5 bg-sky-500/[0.06] border border-sky-500/25 rounded-xl">
        <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0"><Lock className="w-4 h-4 text-sky-300" /></div>
        <div>
          <p className="text-sm font-semibold text-sky-300">Core principle · PHI Handling</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-1">
            Direct identifiers are <span className="text-slate-300">tokenized with specialty-preserving taxonomy tags &amp; -42d date shifts at Ingestion</span>; inference runs on pseudonymized text on HIPAA-eligible <span className="text-slate-300">Bedrock (BAA, zero retention)</span> with 0 PHI in traces.
          </p>
        </div>
      </div>
    </div>
  )
}

function PipelineSpineSelector({
  nodeId, setNodeId, editing, store,
}: {
  nodeId: string; setNodeId: (id: string) => void; editing: boolean; store: InstructionStore
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-sm font-semibold text-white">The pipeline</h2>
        <span className="text-xs text-slate-500">— each node&rsquo;s output feeds the next; select one to view and edit its instruction</span>
      </div>
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {NODE_META.map((n, i) => {
          const Icon = n.icon
          const active = n.id === nodeId
          const hist = store.historyById[n.id]
          const output = hist[hist.length - 1].snapshot.output
          return (
            <div key={n.id} className="contents">
              <button
                onClick={() => { if (!editing) setNodeId(n.id) }} disabled={editing && !active}
                className={`group flex-1 text-left flex flex-col p-3 rounded-xl border transition-all ${
                  active ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20' : 'bg-slate-800/50 border-slate-700/60 hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{i + 1}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-semibold text-white truncate">{n.node}</span>
                  {n.deterministic && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 ml-auto shrink-0 whitespace-nowrap">no LLM</span>}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug mt-2"><span className="text-slate-600">out →</span> {output}</p>
              </button>
              {i < NODE_META.length - 1 && (
                <div className="flex lg:flex-col items-center justify-center shrink-0 lg:w-7 py-1 lg:py-0 text-slate-600">
                  <ArrowRight className="w-4 h-4 rotate-90 lg:rotate-0" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      {editing && <p className="text-xs text-slate-500 mt-2">Finish or cancel your draft to switch nodes.</p>}
    </div>
  )
}

export function AgentInstructionsView({ store }: { store: InstructionStore }) {
  const [nodeId, setNodeId] = useState('synthesis')
  const [editing, setEditing] = useState(false)

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Agent Instructions</h1>
          <p className="text-sm text-slate-400 mt-0.5">The instruction set behind each pipeline node — versioned, sandbox-tested, and fully auditable</p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>
      <div className="px-8 py-6 space-y-6">
        <PrincipleCards />
        <PipelineSpineSelector nodeId={nodeId} setNodeId={setNodeId} editing={editing} store={store} />
        <div className={editing ? '' : 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'}>
          <InstructionEditor key={nodeId} nodeId={nodeId} store={store} onEditingChange={setEditing} />
          {!editing && <NodeRunPanel nodeId={nodeId} />}
        </div>
        <p className="text-xs text-slate-600">
          Abridged for illustration — production instruction sets are versioned per policy pack. Edits run in a sandbox against the full eval suite and promote only on clean regression reports.
        </p>
      </div>
    </div>
  )
}
