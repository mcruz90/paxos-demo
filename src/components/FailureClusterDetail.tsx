import { AlertTriangle, CheckCircle, ChevronLeft, GitBranch, Info, Pencil, Search, Terminal } from 'lucide-react'
import { type View } from '../types'
import { type FailureCluster, scenarioIdForSampleCase, SEVERITY_CLS } from './failureReviewData'
import { InstructionEditor, type InstructionStore, type NodeMeta } from './instructions'

const TREND_GLYPH: Record<string, string> = { up: '↑', flat: '→', down: '↓' }
const TREND_CLS: Record<string, string> = { up: 'text-red-400', flat: 'text-slate-500', down: 'text-emerald-400' }

function OvercautionContextNotes({ cluster }: { cluster: FailureCluster }) {
  if (cluster.id !== 'cl-overcaution') return null
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3 px-4 py-3 bg-emerald-950/20 border border-emerald-500/25 rounded-xl">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-mono text-slate-300">PH-3102 (Ozempic)</span> is the routine case coordinators work in Queue. The evidence-sufficiency fix turned refill-derived duration into a satisfied criterion and is regression-pinned in the eval suite (<span className="font-mono text-slate-300">derivable-duration</span>).
        </p>
      </div>
      <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/60 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          A prior fix relaxed over-caution too aggressively and was <span className="text-red-300">blocked</span> by the sandbox (citation alignment regressed 97%→91%). Suite over-caution currently sits at <span className="font-mono text-slate-300">4%</span> (bar <span className="font-mono text-slate-300">≤5%</span>).
        </p>
      </div>
    </div>
  )
}

function SampleCasesSection({
  selected, onInspectScenario,
}: {
  selected: FailureCluster; onInspectScenario?: (scenarioId: string) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-6 h-6 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center"><AlertTriangle className="w-3.5 h-3.5 text-red-400" /></div>
        <h2 className="text-sm font-semibold text-white">Representative Cases <span className="text-slate-500 font-normal">· {selected.sampleCases.length} of {selected.count}</span></h2>
      </div>
      <div className="space-y-2">
        {selected.sampleCases.map(sc => {
          const sid = scenarioIdForSampleCase(sc.drug)
          return (
            <div key={sc.id} className="flex items-start gap-3 px-4 py-2.5 bg-slate-800/40 border border-slate-700/50 rounded-lg">
              <span className="font-mono text-xs text-slate-400 shrink-0 pt-0.5 w-20">{sc.id}</span>
              <span className="text-xs text-slate-300 shrink-0 w-32">{sc.drug}</span>
              <span className="text-xs text-slate-500 flex-1">{sc.symptom}</span>
              {onInspectScenario && sid && (
                <button
                  type="button" onClick={() => onInspectScenario(sid)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:underline shrink-0"
                >
                  <Terminal className="w-3.5 h-3.5" />Open in 3-Column Trace →
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FailureClusterDetail({
  selected, node, resolvedVersion, store, setView, onBack, onResolved, onInspectScenario,
}: {
  selected: FailureCluster; node: NodeMeta; resolvedVersion?: number; store: InstructionStore
  setView: (v: View) => void; onBack: () => void; onResolved: (version: number) => void
  onInspectScenario?: (scenarioId: string) => void
}) {
  const primaryScenario = selected.sampleCases.map(c => scenarioIdForSampleCase(c.drug)).find(Boolean)
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white">
          <ChevronLeft className="w-3.5 h-3.5" />All clusters
        </button>
        {onInspectScenario && primaryScenario && (
          <button
            type="button" onClick={() => onInspectScenario(primaryScenario)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />Inspect Primary Case in 3-Column Trace →
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${SEVERITY_CLS[selected.severity]}`}>{selected.severity}</span>
        <h2 className="text-lg font-bold text-white">{selected.mode}</h2>
        <span className="text-sm text-slate-500">·</span>
        <span className="text-sm text-slate-400"><span className="font-mono text-slate-200">{selected.count}</span> cases <span className={TREND_CLS[selected.trend]}>{TREND_GLYPH[selected.trend]}</span></span>
        <span className="text-sm text-slate-500">·</span>
        <span className="text-sm text-slate-400">implicates <span className="font-mono text-slate-300">{node.node}</span></span>
      </div>

      {resolvedVersion && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300 flex-1">Cluster resolved — all {selected.count} cases cleared by <span className="font-mono">{node.node} v{resolvedVersion}</span>.</p>
          <button onClick={() => setView('rubric')} className="text-xs text-emerald-300 hover:underline shrink-0">View regression eval →</button>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-6 h-6 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center"><Search className="w-3.5 h-3.5 text-sky-400" /></div>
          <h2 className="text-sm font-semibold text-white">Root-Cause Diagnosis</h2>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
          <p className="text-sm text-slate-300 leading-relaxed">{selected.rootCause}</p>
        </div>
      </div>

      <SampleCasesSection selected={selected} onInspectScenario={onInspectScenario} />
      <OvercautionContextNotes cluster={selected} />

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/30 flex items-center justify-center"><Pencil className="w-3.5 h-3.5 text-violet-400" /></div>
          <h2 className="text-sm font-semibold text-white">Remediate the Cluster</h2>
        </div>
        <div className="flex items-start gap-2 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl mb-3">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed"><span className="text-slate-300 font-medium">Proposed fix:</span> {selected.proposedFix}</p>
        </div>
        <div className="flex items-start gap-2 px-4 py-3 bg-slate-800/30 border border-slate-700/40 rounded-xl mb-3">
          <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Policy rule issue instead? Update the pack in <button onClick={() => setView('specs')} className="text-emerald-400 hover:underline">Workflow Spec</button> on the same eval-gated path.
          </p>
        </div>
        <InstructionEditor key={selected.id} nodeId={selected.node} store={store} proposedDraft={resolvedVersion ? undefined : selected.proposedDraft} clusterCases={selected.count} onPromoted={onResolved} />
      </div>
    </>
  )
}
