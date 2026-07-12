import { Library, FileText, Pencil, Workflow, AlertTriangle, ArrowRight, Gauge } from 'lucide-react'
import { type IconType, type View } from '../types'
import { universalPrimitives } from '../data/scenarios'
import { RUBRIC_DIMENSIONS } from '../data/evalRubric'
import { NODE_META, INITIAL_HISTORY } from './instructions'
import { WORKFLOW_PACKS } from './WorkflowSpecView'
import { FAILURE_CLUSTERS } from './FailureReviewView'

// Build persona home — the holistic altitude the five detailed surfaces lack on
// their own. It renders the AI Lead's control plane as a layered domain model,
// read left→right: the ontology is the foundational schema; the workflow spec +
// agent instructions are the agent built on it; the eval rubric + failure review
// are the governance loop wrapping the agent. Each surface is a live status card
// that drills into its detailed view. Every count is computed from the same
// fixtures the detailed views render, so nothing here is invented or can drift.

type Health = 'ok' | 'attention' | 'critical'

interface Node {
  view: View
  Icon: IconType
  title: string
  role: string
  stat: string
  health: Health
}

const criticalOpen = FAILURE_CLUSTERS.filter(c => c.severity === 'critical').length

const NODES: Record<string, Node> = {
  library:      { view: 'library',      Icon: Library,       title: 'Ontology Library',  role: 'The case skeleton + rule primitives every case shares', stat: `${universalPrimitives.length} rule primitives`,                 health: 'ok' },
  specs:        { view: 'specs',        Icon: FileText,      title: 'Workflow Spec',      role: 'Pipeline structure — nodes, edges, edge cases',         stat: `${NODE_META.length} nodes · ${WORKFLOW_PACKS.length} packs`,     health: 'ok' },
  instructions: { view: 'instructions', Icon: Pencil,        title: 'Agent Instructions', role: 'Behavior — the prompt authored per pipeline node',      stat: `${Object.keys(INITIAL_HISTORY).length} node instructions`,       health: 'ok' },
  rubric:       { view: 'rubric',       Icon: Workflow,      title: 'Eval Rubric',        role: 'The quality gate every change must clear',              stat: `${RUBRIC_DIMENSIONS.length} scoring dimensions`,                  health: 'ok' },
  failures:     { view: 'failures',     Icon: AlertTriangle, title: 'Failure Review',     role: 'Prod monitoring — clusters, root cause, remediation',   stat: `${FAILURE_CLUSTERS.length} clusters · ${criticalOpen} critical`,  health: criticalOpen > 0 ? 'critical' : 'ok' },
}

// Left → right: the foundation, the agent built on it, the governance loop
// wrapping it. `edge` is the relation to the tier on its right.
interface Tier { key: string; label: string; caption: string; views: string[]; edge?: string }
const TIERS: Tier[] = [
  { key: 'foundation', label: 'Foundation',      caption: 'The shared schema every case is built on',            views: ['library'],               edge: 'runs on the schema' },
  { key: 'agent',      label: 'The agent',       caption: 'Pipeline structure + the behavior authored per node', views: ['specs', 'instructions'], edge: 'gates the agent' },
  { key: 'governance', label: 'Governance loop', caption: 'Gates every change and watches it in production',      views: ['rubric', 'failures'] },
]

const HEALTH_META: Record<Health, { dot: string; text: string; label: string }> = {
  ok:        { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Healthy' },
  attention: { dot: 'bg-amber-500',   text: 'text-amber-400',   label: 'Attention' },
  critical:  { dot: 'bg-red-500',     text: 'text-red-400',     label: 'Action needed' },
}

function NodeCard({ node, onOpen }: { node: Node; onOpen: () => void }) {
  const { Icon, title, role, stat, health } = node
  const h = HEALTH_META[health]
  return (
    <button
      onClick={onOpen}
      className="group text-left flex flex-col flex-1 p-4 rounded-xl border bg-slate-800/50 border-slate-700/60 hover:border-emerald-500/50 transition-all"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-white leading-tight">{title}</p>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600 ml-auto group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-slate-500 leading-snug flex-1">{role}</p>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs font-mono text-slate-300">{stat}</p>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${h.dot}`} />
          <span className={`text-[11px] font-medium ${h.text}`}>{h.label}</span>
        </div>
      </div>
    </button>
  )
}

// Directional relation between a tier and the one on its right (turns to point
// down when the tiers stack on narrow screens).
function Edge({ label }: { label: string }) {
  return (
    <div className="flex lg:flex-col items-center justify-center gap-1.5 shrink-0 lg:w-20 py-1 lg:py-0 text-slate-500">
      <ArrowRight className="w-4 h-4 rotate-90 lg:rotate-0 shrink-0" />
      <span className="text-[10px] uppercase tracking-wide text-center leading-tight">{label}</span>
    </div>
  )
}

export function BuildOverview({ setView }: { setView: (v: View) => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Gauge className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-bold font-display text-white">Control Plane</h1>
        </div>
        <p className="text-sm text-slate-400 mt-0.5">
          The whole system the AI Lead governs, as a layered model — the foundation, the agent built on it, and the governance loop around it. Open any surface to drill in.
        </p>
      </div>

      <div className="p-8">
        <p className="text-sm text-slate-300 leading-relaxed mb-6 max-w-4xl">
          Governing a probabilistic system is a loop, not a one-way build. Read it left to right: the{' '}
          <span className="text-slate-400">ontology</span> is the schema everything rests on; the{' '}
          <span className="text-slate-400">agent</span> — pipeline structure plus authored behavior — runs over it;
          and the <span className="text-slate-400">governance loop</span> gates every change and feeds production
          failures back as versioned, re-gated fixes.
        </p>

        {/* Layered domain model — foundation → agent → governance, left to right */}
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          {TIERS.map((tier, i) => (
            <div key={tier.key} className="contents">
              <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="mb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-mono text-slate-600">L{i + 1}</span>
                    <h2 className="text-sm font-semibold text-white">{tier.label}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{tier.caption}</p>
                </div>
                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-1">
                  {tier.views.map(v => (
                    <NodeCard key={v} node={NODES[v]} onOpen={() => setView(NODES[v].view)} />
                  ))}
                </div>
              </div>
              {tier.edge && <Edge label={tier.edge} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
