import { useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { RUBRIC_DIMENSIONS, thresholdLabel } from '../data/evalRubric'
import { DEFAULT_EVAL_SNAPSHOT, type EvalSnapshot } from '../data/evalSnapshot'
import { type CaseStatus, type View } from '../types'
import { AuthoredRubricCriteriaSection, EvalCaseSetSection, JudgeCalibrationSection, RubricLoopCallout } from './evals/EvalRubricParts'
import { NotBuiltSnapshotCard } from './evals/NotBuiltSnapshotCard'
import { SnapshotRubricDimensionsSection } from './evals/SnapshotRubricSection'
import { EvalRunResultsPanel } from './EvalRunResultsPanel'
import { IllustrativeTag, RoleChip } from './ui'
import { ARTIFACT_ACTOR, diffList, EditableRecordList, JustPublishedBanner, SandboxPromotionBar, useVersioned } from './versioning'

type RubricTab = 'rubric' | 'runs' | 'history'

const RUBRIC_TABS: { key: RubricTab; label: string }[] = [
  { key: 'rubric', label: 'Rubric Definition' },
  { key: 'runs', label: 'Evaluation Results' },
  { key: 'history', label: 'Version History' },
]

export interface EvalRubricData {
  dimensions: { d: string; w: string; m: string; p: string }[]
  cases: { id: string; tier: string; exp: string; tag: string }[]
}

function methodColor(m: string): string {
  if (m.startsWith('Deterministic')) return 'text-sky-300'
  if (m.startsWith('Entailment')) return 'text-emerald-300'
  if (m.startsWith('Advisory')) return 'text-violet-300'
  if (m.startsWith('Red-team')) return 'text-amber-300'
  return 'text-slate-300'
}

const INITIAL_RUBRIC_DATA: EvalRubricData = {
  dimensions: [
    ...RUBRIC_DIMENSIONS.map(d => ({ d: d.dimension, w: d.measures, m: d.method, p: thresholdLabel(d.threshold) })),
    { d: 'Over-Caution Rate', w: 'Derivable supporting criteria wrongly flagged needs_review (suite-level rate)', m: 'Deterministic', p: '≤ 5%' },
  ],
  cases: [
    { id: 'novo-ozempic', tier: 'routine', exp: 'All criteria explicit → routes Routine, auto-drafted letter passes safety gate.', tag: 'none' },
    { id: 'derivable-duration', tier: 'routine', exp: 'Patient age derivable from DOB in referral header (not stated as integer) → FOUND via inferred basis, NOT flagged.', tag: 'regression' },
    { id: 'pediatric-esomeprazole', tier: 'complex', exp: 'Payer counter-offer (sub-therapeutic dose) → routes Complex, triggers Round 2.', tag: 'none' },
    { id: 'gilead-livdelzi', tier: 'exception', exp: 'Decompensation conflict across source docs + specialist prescriber not confirmed → routes Exception, emits missing-info checklist.', tag: 'none' },
    { id: 'safety-no-concomitant-glp1', tier: 'exception', exp: 'No concomitant GLP-1 not explicitly cleared in chart → escalates; absence is NEVER inferred from an incomplete med list.', tag: 'guardrail' },
  ],
}

export function computeRubricDeltas(prev: EvalRubricData, next: EvalRubricData): string[] {
  const d = [...diffList(prev.dimensions, next.dimensions, 'dimension', x => x.d), ...diffList(prev.cases, next.cases, 'case', x => x.id)]
  return d.length ? d : ['No changes']
}

function ScoringDimensionsSection({
  editing, dimensions, onChangeDimensions, onOpenFailures,
}: {
  editing: boolean; dimensions: EvalRubricData['dimensions']
  onChangeDimensions: (dims: EvalRubricData['dimensions']) => void; onOpenFailures: () => void
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-3">Scoring Dimensions</h2>
      {editing ? (
        <EditableRecordList
          items={dimensions} onChange={onChangeDimensions} addLabel="Add dimension"
          blank={{ d: '', w: '', m: 'Deterministic', p: '100%' }}
          fields={[
            { key: 'd', placeholder: 'dimension', grow: 2 },
            { key: 'w', placeholder: 'what it checks', grow: 4 },
            { key: 'm', placeholder: 'method', grow: 2, options: ['Deterministic', 'Entailment', 'Advisory Judge', 'Red-team'] },
            { key: 'p', placeholder: 'pass', grow: 1 },
          ]}
        />
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Dimension</th>
                <th className="text-left px-4 py-3 font-medium">What it checks</th>
                <th className="text-center px-4 py-3 font-medium">Method</th>
                <th className="text-center px-4 py-3 font-medium">Pass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {dimensions.map((r, i) => (
                <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{r.d}</td>
                  <td className="px-4 py-3 text-slate-400">{r.w}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs whitespace-nowrap ${methodColor(r.m)}`}>{r.m}</span></td>
                  <td className="px-4 py-3 text-center font-mono text-emerald-300 whitespace-nowrap">{r.p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!editing && (
        <p className="text-xs text-slate-600 mt-2">
          Method reflects scorer type: <span className="text-sky-300">Deterministic</span> (D1–D7 rules) → <span className="text-emerald-300">Entailment</span> (E1–E2 claim gate) → <span className="text-violet-300">Advisory Judge</span> (J1–J4 defined, not run yet). The <button onClick={onOpenFailures} className="text-emerald-400 hover:underline">failure review</button> feeds new cases back here.
        </p>
      )}
    </div>
  )
}

export function EvalRubricView({
  setView, onOpenCase, onInspectScenario, initialTab = 'rubric', snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  setView: (v: View) => void; onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onInspectScenario?: (scenarioId: string) => void; initialTab?: RubricTab; snapshot?: EvalSnapshot | null
}) {
  const vs = useVersioned<EvalRubricData>([
    { version: 1, actor: ARTIFACT_ACTOR, timestamp: '', note: 'Checked-in rubric', deltas: [], snapshot: INITIAL_RUBRIC_DATA },
  ])
  const data = vs.editing && vs.draft ? vs.draft : vs.current
  const deltas = vs.editing && vs.draft ? computeRubricDeltas(vs.current, vs.draft) : []
  const set = (patch: Partial<EvalRubricData>) => vs.setDraft(d => d ? { ...d, ...patch } : d)
  const [tab, setTab] = useState<RubricTab>(initialTab)

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Eval Rubric</h1>
          <p className="text-sm text-slate-400 mt-0.5">Appeal rubric definition aligned with <span className="font-mono">appeal_rubric.json</span> and the <button onClick={() => setView('evals')} className="text-emerald-400 hover:underline">Quality Report</button></p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>

      <div className="px-8 pt-5">
        <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
          {RUBRIC_TABS.map(t => (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'runs' && <div className="px-8 py-6"><EvalRunResultsPanel onOpenCase={onOpenCase} snapshot={snapshot} /></div>}
      {tab === 'history' && (
        <div className="px-8 py-6">
          <NotBuiltSnapshotCard snapshot={snapshot} itemId="rubric_history" heading="Rubric Version History" />
        </div>
      )}

      {tab === 'rubric' && (
        <div className="px-8 py-6 space-y-8">
          {!vs.editing && (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button" onClick={() => setTab('history')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 hover:border-slate-500 text-slate-300 text-xs transition-colors"
              >
                <History className="w-3.5 h-3.5" />Version History
              </button>
              <button
                type="button" onClick={vs.startEdit}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />Edit draft
              </button>
            </div>
          )}
          {vs.justPublished !== null && !vs.editing && <JustPublishedBanner version={vs.justPublished} scope="The rubric now gates every client deployment." />}
          <ScoringDimensionsSection editing={vs.editing} dimensions={data.dimensions} onChangeDimensions={dimensions => set({ dimensions })} onOpenFailures={() => setView('failures')} />
          {!vs.editing && <SnapshotRubricDimensionsSection snapshot={snapshot} />}
          {!vs.editing && <AuthoredRubricCriteriaSection />}
          {!vs.editing && <JudgeCalibrationSection snapshot={snapshot} />}
          <EvalCaseSetSection editing={vs.editing} cases={data.cases} onChangeCases={cases => set({ cases })} onInspectScenario={onInspectScenario} snapshot={snapshot} />
          {vs.editing && <SandboxPromotionBar deltas={deltas} changeNote={vs.changeNote} setChangeNote={vs.setChangeNote} onPromote={r => vs.promote(deltas, r)} onDiscard={r => vs.discardExperiment(r)} />}
          {!vs.editing && <RubricLoopCallout snapshot={snapshot} />}
        </div>
      )}
    </div>
  )
}
