import { Clock, RotateCcw, Stethoscope, Terminal } from 'lucide-react'
import { JUDGE_CALIBRATION_SPEC, RUBRIC_DIMENSIONS, thresholdLabel } from '../../data/evalRubric'
import { DEFAULT_EVAL_SNAPSHOT, EVAL_SNAPSHOT_SOURCE_NOTE, formatShortCommit } from '../../data/evalSnapshot'
import { SUITE_SIZE } from '../../data/evalRun'
import { scenarios } from '../../data/scenarios'
import { type CaseTier } from '../../types'
import { TierBadge } from '../ui'
import { EditableRecordList } from '../versioning'

export function AuthoredRubricCriteriaSection() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-1">
        Advisory Judge Rubric Criteria · J1–J4 <span className="text-violet-300 font-normal">(not run yet)</span>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        Anchored 1–4 ordinal dimensions defined in <span className="font-mono">appeal_rubric.json</span> — no judge runs today; scores remain strictly advisory until calibrated on de-identified letters.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {RUBRIC_DIMENSIONS.filter(d => d.criteria).map(d => (
          <div key={d.dimension} className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-violet-300">{d.dimension}</h3>
              <span className="ml-auto font-mono text-xs text-slate-400">{d.grader} · {thresholdLabel(d.threshold)}</span>
            </div>
            <ul className="space-y-1.5">
              {d.criteria!.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className="text-violet-400 mt-0.5 shrink-0">✓</span><span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export function JudgeCalibrationSection({ snapshot = DEFAULT_EVAL_SNAPSHOT }: { snapshot?: typeof DEFAULT_EVAL_SNAPSHOT }) {
  const judgeDims = snapshot?.appeal_rubric.dimensions.filter(d => d.kind === 'judge') ?? []
  const maxN = judgeDims.reduce((acc, d) => Math.max(acc, d.calibration?.n ?? 0), 0)
  const firstKappa = judgeDims.find(d => typeof d.calibration?.kappa === 'number')?.calibration?.kappa ?? null
  const bar = snapshot?.appeal_rubric.judge_bar
  const minLetters = bar?.min_letters ?? JUDGE_CALIBRATION_SPEC.proposedMinLetters
  const minKappa = bar?.min_kappa ?? JUDGE_CALIBRATION_SPEC.proposedMinKappa
  const barStatus = bar?.status ?? 'not_run'
  const stats = [
    { label: 'Judge Runner', value: snapshot ? `${snapshot.appeal_rubric.state} only` : 'Not run', sub: 'no model judge runs yet' },
    { label: 'Clinician Ratings', value: snapshot ? `${maxN} / ${minLetters}` : 'not_run', sub: 'labeled de-identified letters' },
    { label: `Bar (${barStatus})`, value: `κ_w ≥ ${minKappa.toFixed(2)}`, sub: firstKappa !== null ? `measured κ_w = ${firstKappa.toFixed(2)}` : 'unmeasured (κ = —)' },
    { label: 'Held-Out Protocol', value: 'One-shot', sub: 'rotate set after tuning (clearauth-eval decision 0004)' },
  ]
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-violet-400" />
          Judge Calibration Status <span className="text-violet-300 font-normal">· J1–J4 Advisory Rubric</span>
        </h2>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border border-amber-500/30 bg-amber-500/10 text-amber-300">
          {snapshot ? `${snapshot.appeal_rubric.state} · bar ${barStatus} · advisory only` : 'not_run · awaiting eval_snapshot.json'}
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
  editing, cases, onChangeCases, onInspectScenario,
}: {
  editing: boolean
  cases: { id: string; tier: string; exp: string; tag: string }[]
  onChangeCases: (cases: { id: string; tier: string; exp: string; tag: string }[]) => void
  onInspectScenario?: (scenarioId: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white mb-0.5">Eval Case Set (Illustrative Fixture)</h2>
          <p className="text-xs text-slate-500">
            Representative scenarios (demo fixture <span className="font-mono text-slate-400">{SUITE_SIZE}</span> target placeholder — live counts will read from <span className="font-mono">eval_snapshot.json</span>).
          </p>
        </div>
        <span
          title={EVAL_SNAPSHOT_SOURCE_NOTE}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-slate-600/60 bg-slate-800/60 text-slate-300"
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {DEFAULT_EVAL_SNAPSHOT
            ? `Example snapshot (PR #219) · v${DEFAULT_EVAL_SNAPSHOT.schema_version} · ${formatShortCommit(DEFAULT_EVAL_SNAPSHOT.as_of_commit)}`
            : 'No snapshot loaded · awaiting eval_snapshot.json'}
        </span>
      </div>
      {DEFAULT_EVAL_SNAPSHOT && (
        <p className="text-[11px] font-medium text-amber-300">{EVAL_SNAPSHOT_SOURCE_NOTE}</p>
      )}
      {editing ? (
        <EditableRecordList
          items={cases} onChange={onChangeCases} addLabel="Add eval case"
          blank={{ id: '', tier: 'routine', exp: '', tag: 'none' }}
          fields={[
            { key: 'id', placeholder: 'case id', grow: 2 },
            { key: 'tier', placeholder: 'tier', grow: 1, options: ['routine', 'complex', 'exception'] },
            { key: 'exp', placeholder: 'expected behavior', grow: 5 },
            { key: 'tag', placeholder: 'tag', grow: 1, options: ['none', 'regression', 'guardrail'] },
          ]}
        />
      ) : (
        <div className="space-y-2">
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

export function RubricLoopCallout() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
      <RotateCcw className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <p className="text-sm text-slate-400 leading-relaxed">
        Held-out wording sets are scored once only: after a fix tunes on what a held-out run surfaced, that wording rotates to development and a fresh held-out set is authored before the next run (Decision 0004).
      </p>
    </div>
  )
}
