import { CheckCircle2, RotateCcw, Stethoscope, Terminal } from 'lucide-react'
import { JUDGE_CALIBRATION, RUBRIC_DIMENSIONS, thresholdLabel } from '../../data/evalRubric'
import { SUITE_SIZE } from '../../data/evalRun'
import { scenarios } from '../../data/scenarios'
import { type CaseTier } from '../../types'
import { DUAL_REVIEWER_KAPPA } from '../inspector/inspectorModel'
import { TierBadge } from '../ui'
import { EditableRecordList } from '../versioning'

export function AuthoredRubricCriteriaSection() {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-1">
        Authored Rubric Criteria <span className="text-violet-300 font-normal">· LLM-as-judge</span>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        For subjective dimensions with no deterministic answer key, the AI Lead authors explicit pass criteria; an LLM grades each letter against them (HealthBench-style).
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

export function JudgeCalibrationSection() {
  const stats = [
    { label: 'Judge ↔ clinician agreement', value: `${JUDGE_CALIBRATION.agreementPct}%`, sub: `on ${JUDGE_CALIBRATION.labeledLetters} labeled letters` },
    { label: "Cohen's κ", value: JUDGE_CALIBRATION.cohenKappa.toFixed(2), sub: 'inter-rater · substantial' },
    { label: 'Dual-reviewer /chart-review', value: DUAL_REVIEWER_KAPPA.kappa.toFixed(2), sub: `${DUAL_REVIEWER_KAPPA.agreementPct}% on n=${DUAL_REVIEWER_KAPPA.sampleCriteria} criteria` },
    { label: 'Last calibrated', value: JUDGE_CALIBRATION.lastCalibrated, sub: JUDGE_CALIBRATION.recalibrateOn },
  ]
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
        <Stethoscope className="w-4 h-4 text-violet-400" />
        Is the Judge Trustworthy? <span className="text-violet-300 font-normal">· LLM-as-judge calibration</span>
      </h2>
      <p className="text-xs text-slate-500 mb-3">
        An LLM grader only gets to gate clinical letters if it agrees with clinicians. Calibrated alongside Stage 5 dual-reviewer `/chart-review` κ = {DUAL_REVIEWER_KAPPA.kappa.toFixed(2)}.
      </p>
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
          <p className="text-xs text-slate-300 leading-relaxed">{JUDGE_CALIBRATION.escalation}</p>
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
          <h2 className="text-sm font-semibold text-white mb-0.5">Eval Case Set</h2>
          <p className="text-xs text-slate-500">
            Representative cases — full regression suite is <span className="font-mono text-slate-400">{SUITE_SIZE}</span> cases across all 6 pipeline stages.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {DUAL_REVIEWER_KAPPA.graduatedEdits} graduated human_edited cases
        </span>
      </div>
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
                <button
                  type="button" onClick={() => onInspectScenario(c.id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 hover:underline shrink-0 pt-0.5"
                >
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
        The case set grows from production and `human_edited` coordinator refinements. Every reviewed failure graduates into a regression or guardrail fixture across `doc_type_eval`, `chart_eval`, and `appeal_eval`.
      </p>
    </div>
  )
}
