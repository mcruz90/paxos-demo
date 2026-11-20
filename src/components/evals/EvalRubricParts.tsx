import { RotateCcw, Stethoscope, Terminal } from 'lucide-react'
import { JUDGE_CALIBRATION_SPEC } from '../../data/evalRubric'
import {
  DEFAULT_EVAL_SNAPSHOT,
  type Dimension,
  type EvalSnapshot,
  NOT_IN_SNAPSHOT,
  formatClearauthDecisionLabel,
} from '../../data/evalSnapshot'
import { scenarios } from '../../data/scenarios'
import { type CaseTier } from '../../types'
import { TierBadge } from '../ui'
import { EditableRecordList } from '../versioning'
import { CaseSetsSnapshotCard } from './CaseSetsSnapshotCard'

function shortDimensionCode(id: string): string {
  return id.split('_')[0] || id
}

function formatJudgeRange(dims: Dimension[]): string {
  if (dims.length === 0) return ''
  const first = shortDimensionCode(dims[0].id)
  const last = shortDimensionCode(dims[dims.length - 1].id)
  return dims.length === 1 || first === last ? first : `${first}–${last}`
}

function formatJudgeState(rubric: NonNullable<EvalSnapshot['appeal_rubric']>, dims: Dimension[]): string {
  if (dims.length > 0 && dims.every(d => d.state === 'measured')) return 'measured'
  if (dims.some(d => d.state === 'measured')) return 'partially measured'
  return rubric.state === 'defined' ? 'not run yet' : rubric.state
}

export function AuthoredRubricCriteriaSection({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null } = {}) {
  const judgeDims = snapshot?.appeal_rubric?.dimensions.filter(d => d.kind === 'judge') ?? null
  if (!snapshot?.appeal_rubric || !judgeDims || judgeDims.length === 0) {
    return (
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-white">Advisory Judge Rubric Dimensions</h2>
        <span className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</span>
      </div>
    )
  }

  const range = formatJudgeRange(judgeDims)
  const stateLabel = formatJudgeState(snapshot.appeal_rubric, judgeDims)

  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-1">
        Advisory Judge Rubric Dimensions{range ? ` · ${range}` : ''}{' '}
        <span className="text-violet-300 font-normal">({stateLabel})</span>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        {stateLabel === 'measured' ? (
          <>
            Anchored ordinal dimensions read from <span className="font-mono">eval_snapshot.json</span> (<span className="font-mono">appeal_rubric</span>) — advisory rubric dimensions scored in this snapshot.
          </>
        ) : stateLabel === 'partially measured' ? (
          <>
            Anchored ordinal dimensions read from <span className="font-mono">eval_snapshot.json</span> (<span className="font-mono">appeal_rubric</span>) — partially measured; unmeasured dimensions remain advisory definitions only.
          </>
        ) : (
          <>
            Anchored ordinal dimensions read from <span className="font-mono">eval_snapshot.json</span> (<span className="font-mono">appeal_rubric</span>) — no judge runs today; scores remain strictly advisory until calibrated on de-identified letters.
          </>
        )}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {judgeDims.map(d => {
          const cal = d.calibration
          const calText = cal
            ? `n=${cal.n} · κ=${cal.kappa === null || cal.kappa === undefined ? '—' : cal.kappa.toFixed(2)}`
            : d.state
          return (
            <div key={d.id} className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold font-mono text-violet-300">{d.id}</h3>
                <span className="ml-auto font-mono text-xs text-slate-400">{d.state} · {calText}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{d.question}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function JudgeCalibrationSection({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  if (!snapshot || !snapshot.appeal_rubric) {
    return (
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-violet-400" />
          Judge Calibration Status
        </h2>
        <span className="text-xs font-mono text-amber-300">{NOT_IN_SNAPSHOT}</span>
      </div>
    )
  }

  const judgeDims = snapshot.appeal_rubric.dimensions.filter(d => d.kind === 'judge')
  const range = formatJudgeRange(judgeDims)
  const stateSummary = formatJudgeState(snapshot.appeal_rubric, judgeDims)
  const maxN = judgeDims.reduce((acc, d) => Math.max(acc, d.calibration?.n ?? 0), 0)
  const firstKappa = judgeDims.find(d => typeof d.calibration?.kappa === 'number')?.calibration?.kappa ?? null
  const bar = snapshot.appeal_rubric.judge_bar
  const heldOutLabel = formatClearauthDecisionLabel(snapshot.redteam?.decision)
  const stats = [
    {
      label: 'Judge Runner',
      value: stateSummary === 'not run yet' ? `${snapshot.appeal_rubric.state} only` : stateSummary,
      sub: stateSummary === 'not run yet' ? 'no model judge runs yet' : 'read from snapshot appeal_rubric',
    },
    { label: 'Clinician Ratings', value: `${maxN} / ${bar.min_letters}`, sub: 'labeled de-identified letters' },
    { label: `Bar (${bar.status})`, value: `κ_w ≥ ${bar.min_kappa.toFixed(2)}`, sub: firstKappa !== null ? `measured κ_w = ${firstKappa.toFixed(2)}` : 'unmeasured (κ = —)' },
    { label: 'Held-Out Protocol', value: 'One-shot', sub: `rotate set after tuning (${heldOutLabel})` },
  ]
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-violet-400" />
          Judge Calibration Status{range ? <span className="text-violet-300 font-normal">· {range} Advisory Rubric</span> : null}
        </h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border border-amber-500/30 bg-amber-500/10 text-amber-300">
          {snapshot.appeal_rubric.state} · bar {bar.status} · advisory only
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{JUDGE_CALIBRATION_SPEC.method} — defined in <span className="font-mono">calibration.py</span>.</p>
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(t => (
            <div key={t.label} className="rounded-lg bg-slate-900/40 border border-slate-700/50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1.5 leading-snug">{t.label}</p>
              <p className="text-xl font-bold font-mono text-violet-300 leading-none">{t.value}</p>
              <p className="text-xs text-slate-500 mt-1.5 leading-snug">{t.sub}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-slate-900/40 border border-slate-700/50 rounded-lg">
          <Stethoscope className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">{JUDGE_CALIBRATION_SPEC.policy}</p>
        </div>
      </div>
    </div>
  )
}

export function EvalCaseSetSection({
  editing, cases, onChangeCases, onInspectScenario, snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  editing: boolean
  cases: { id: string; tier: string; exp: string; tag: string }[]
  onChangeCases: (cases: { id: string; tier: string; exp: string; tag: string }[]) => void
  onInspectScenario?: (scenarioId: string) => void
  snapshot?: EvalSnapshot | null
}) {
  return (
    <div className="space-y-4">
      <CaseSetsSnapshotCard snapshot={snapshot} />
      {editing ? (
        <EditableRecordList
          items={cases} onChange={onChangeCases} addLabel="Add walkthrough scenario"
          blank={{ id: '', tier: 'routine', exp: '', tag: 'none' }}
          fields={[
            { key: 'id', placeholder: 'case id', grow: 2 },
            { key: 'tier', placeholder: 'tier', grow: 1, options: ['routine', 'complex', 'exception'] },
            { key: 'exp', placeholder: 'expected behavior', grow: 5 },
            { key: 'tag', placeholder: 'tag', grow: 1, options: ['none', 'regression', 'guardrail'] },
          ]}
        />
      ) : cases.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Qualitative Walkthrough Scenarios (No Eval Scores)
          </p>
          {cases.map((c, i) => (
            <div key={i} className="flex items-start gap-4 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
              <span className="font-mono text-xs text-emerald-400 w-44 shrink-0 pt-0.5">{c.id}</span>
              <TierBadge tier={c.tier as CaseTier} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 leading-relaxed">{c.exp}</p>
                <div className="flex gap-1.5 mt-1">
                  {c.tag === 'regression' && <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">regression test</span>}
                  {c.tag === 'guardrail' && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">guardrail test</span>}
                </div>
              </div>
              {onInspectScenario && scenarios[c.id] && (
                <button type="button" onClick={() => onInspectScenario(c.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:underline shrink-0 pt-0.5">
                  <Terminal className="w-3.5 h-3.5" />Inspect Trace →
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RubricLoopCallout({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: EvalSnapshot | null }) {
  const decisionLabel = formatClearauthDecisionLabel(snapshot?.redteam?.decision)
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
      <RotateCcw className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <p className="text-sm text-slate-400 leading-relaxed">
        Held-out wording sets are scored once only: after a fix tunes on what a held-out run surfaced, that wording rotates to development and a fresh held-out set is authored before the next run ({decisionLabel}).
      </p>
    </div>
  )
}
