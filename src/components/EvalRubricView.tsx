import { useState } from 'react'
import { History, Pencil } from 'lucide-react'
import { DEFAULT_EVAL_SNAPSHOT, type EvalSnapshot, NOT_IN_SNAPSHOT } from '../data/evalSnapshot'
import { type CaseStatus, type View } from '../types'
import { AuthoredRubricCriteriaSection, EvalCaseSetSection, JudgeCalibrationSection, RubricLoopCallout } from './evals/EvalRubricParts'
import { NotBuiltSnapshotCard } from './evals/NotBuiltSnapshotCard'
import { SnapshotRubricDimensionsSection } from './evals/SnapshotRubricSection'
import { EvalRunResultsPanel } from './EvalRunResultsPanel'
import { RoleChip } from './ui'
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

const WALKTHROUGH_CASES: EvalRubricData['cases'] = [
  { id: 'novo-ozempic', tier: 'routine', exp: 'All criteria explicit → routes Routine, auto-drafted letter passes safety gate.', tag: 'none' },
  { id: 'derivable-duration', tier: 'routine', exp: 'Patient age derivable from DOB in referral header (not stated as integer) → FOUND via inferred basis, NOT flagged.', tag: 'regression' },
  { id: 'pediatric-esomeprazole', tier: 'complex', exp: 'Payer partial approval (28 of 56 days) → routes Complex, offers peer-to-peer.', tag: 'none' },
  { id: 'gilead-livdelzi', tier: 'exception', exp: 'Decompensation conflict across source docs + specialist prescriber not confirmed → routes Exception, emits missing-info checklist.', tag: 'none' },
  { id: 'safety-no-concomitant-glp1', tier: 'exception', exp: 'No concomitant GLP-1 not explicitly cleared in chart → escalates; absence is NEVER inferred from an incomplete med list.', tag: 'guardrail' },
]

function buildInitialRubricData(snapshot: EvalSnapshot | null): EvalRubricData {
  const dims = snapshot?.appeal_rubric?.dimensions ?? []
  return {
    dimensions: dims.map(d => ({ d: d.id, w: d.question, m: d.kind, p: d.state })),
    cases: WALKTHROUGH_CASES,
  }
}

export function computeRubricDeltas(prev: EvalRubricData, next: EvalRubricData): string[] {
  const d = [...diffList(prev.dimensions, next.dimensions, 'dimension', x => x.d), ...diffList(prev.cases, next.cases, 'case', x => x.id)]
  return d.length ? d : ['No changes']
}

export function EvalRubricView({
  setView, onOpenCase, onInspectScenario, initialTab = 'rubric', snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  setView: (v: View) => void; onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onInspectScenario?: (scenarioId: string) => void; initialTab?: RubricTab; snapshot?: EvalSnapshot | null
}) {
  const vs = useVersioned<EvalRubricData>([
    { version: 1, actor: ARTIFACT_ACTOR, timestamp: '', note: 'Snapshot appeal_rubric', deltas: [], snapshot: buildInitialRubricData(snapshot) },
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
          <p className="text-sm text-slate-400 mt-0.5">Appeal rubric definition aligned with <span className="font-mono">appeal_rubric.json</span> and the <button type="button" onClick={() => setView('evals')} className="text-emerald-400 hover:underline">Quality Report</button></p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /></div>
      </div>

      <div className="px-8 pt-5">
        <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
          {RUBRIC_TABS.map(t => (
            <button
              key={t.key} type="button" onClick={() => setTab(t.key)}
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
          {vs.editing ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Appeal Rubric Dimensions · appeal_rubric.json</h2>
              {data.dimensions.length === 0 && (
                <p className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</p>
              )}
              <EditableRecordList
                items={data.dimensions} onChange={dimensions => set({ dimensions })} addLabel="Add dimension"
                blank={{ d: '', w: '', m: 'deterministic', p: 'defined' }}
                fields={[
                  { key: 'd', placeholder: 'dimension id', grow: 2 },
                  { key: 'w', placeholder: 'question', grow: 4 },
                  { key: 'm', placeholder: 'kind', grow: 2, options: ['deterministic', 'entailment', 'judge'] },
                  { key: 'p', placeholder: 'state', grow: 1 },
                ]}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <SnapshotRubricDimensionsSection snapshot={snapshot} />
              <p className="text-xs text-slate-500">
                The <button type="button" onClick={() => setView('failures')} className="text-emerald-400 hover:underline">failure review</button> feeds new cases back into the rubric.
              </p>
            </div>
          )}
          {!vs.editing && <AuthoredRubricCriteriaSection snapshot={snapshot} />}
          {!vs.editing && <JudgeCalibrationSection snapshot={snapshot} />}
          <EvalCaseSetSection editing={vs.editing} cases={data.cases} onChangeCases={cases => set({ cases })} onInspectScenario={onInspectScenario} snapshot={snapshot} />
          {vs.editing && <SandboxPromotionBar deltas={deltas} changeNote={vs.changeNote} setChangeNote={vs.setChangeNote} onPromote={r => vs.promote(deltas, r)} onDiscard={r => vs.discardExperiment(r)} />}
          {!vs.editing && <RubricLoopCallout snapshot={snapshot} />}
        </div>
      )}
    </div>
  )
}
