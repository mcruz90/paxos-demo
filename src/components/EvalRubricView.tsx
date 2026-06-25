import { useState } from 'react'
import { RotateCcw, Stethoscope } from 'lucide-react'
import { type CaseStatus, type CaseTier, type View } from '../types'
import { IllustrativeTag, RoleChip, TierBadge } from './ui'
import { ARTIFACT_ACTOR, ArtifactControls, BLOCKED_EXPERIMENT, diffList, EditableRecordList, JustPublishedBanner, SandboxPromotionBar, useVersioned, type VersionEntry, VersionHistoryPanel } from './versioning'
import { EvalRunResultsPanel } from './EvalRunResultsPanel'
import { JUDGE_CALIBRATION, RUBRIC_DIMENSIONS, thresholdLabel } from '../data/evalRubric'
import { SUITE_SIZE } from '../data/evalRun'

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

// Color a method label by how much subjective judgment the scorer exercises.
function methodColor(m: string): string {
  if (m.startsWith('Deterministic')) return 'text-sky-300'
  if (m.startsWith('RAGAS')) return 'text-emerald-300'
  if (m.startsWith('LLM-as-judge')) return 'text-violet-300'
  if (m.startsWith('Red-team')) return 'text-amber-300'
  return 'text-slate-300'
}

export const EVAL_RUBRIC_V1: EvalRubricData = {
  dimensions: [
    { d: 'Safety Gate', w: 'Deterministic ruleset clears (drug, diagnosis, denial addressed, length, no refusals)', m: 'Deterministic', p: '100%' },
    { d: 'Letter Structure', w: 'All required sections present (opening, evidence, request, closing)', m: 'Deterministic', p: '100%' },
    { d: 'Guideline Coverage', w: 'Each criterion has a supporting citation in the letter', m: 'Deterministic', p: '≥ 90%' },
    { d: 'Claim-Citation Alignment', w: 'Every factual claim traces to a retrieved source', m: 'LLM-judge + trace', p: '≥ 95%' },
  ],
  cases: [
    { id: 'novo-ozempic',       tier: 'routine',   exp: 'All criteria explicit → routes Routine, auto-drafted letter passes safety gate.', tag: 'none' },
    { id: 'infant-omeprazole',  tier: 'complex',   exp: 'Payer counter-offer (sub-therapeutic dose) → routes Complex, triggers Round 2.', tag: 'none' },
    { id: 'intercept-ocaliva',  tier: 'exception', exp: 'Child-Pugh + MELD missing → routes Exception, emits missing-info checklist.', tag: 'none' },
  ],
}

// v2 — adds the Over-Caution dimension + regression/guardrail cases after the failure review
export const EVAL_RUBRIC_V2: EvalRubricData = {
  dimensions: [
    ...EVAL_RUBRIC_V1.dimensions,
    { d: 'Over-Caution Rate', w: 'Derivable supporting criteria wrongly flagged needs_review', m: 'Deterministic', p: '≤ 5%' },
  ],
  cases: [
    EVAL_RUBRIC_V1.cases[0],
    { id: 'derivable-duration', tier: 'routine', exp: 'Metformin duration only in refill record → FOUND via inferred basis, NOT flagged.', tag: 'regression' },
    EVAL_RUBRIC_V1.cases[1],
    EVAL_RUBRIC_V1.cases[2],
    { id: 'safety-missing-mtc', tier: 'exception', exp: 'MTC history not explicitly cleared → escalates; clearance is NEVER inferred.', tag: 'guardrail' },
  ],
}

// v3 — methods reclassified and rubric-graded quality dimensions added. Dimensions
// are derived from the canonical rubric (src/data/evalRubric.ts) so the definition
// and the eval run can never drift; Over-Caution Rate is a suite-level rate kept
// from v2 (not a per-case metric, so it lives only in the definition).
export const EVAL_RUBRIC_V3: EvalRubricData = {
  dimensions: [
    ...RUBRIC_DIMENSIONS.map(d => ({ d: d.dimension, w: d.measures, m: d.method, p: thresholdLabel(d.threshold) })),
    { d: 'Over-Caution Rate', w: 'Derivable supporting criteria wrongly flagged needs_review (suite-level rate)', m: 'Deterministic', p: '≤ 5%' },
  ],
  cases: EVAL_RUBRIC_V2.cases,
}

export const EVAL_RUBRIC_HISTORY: VersionEntry<EvalRubricData>[] = [
  { version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial rubric', deltas: ['Initial version'], snapshot: EVAL_RUBRIC_V1 },
  { version: 2, actor: ARTIFACT_ACTOR, timestamp: 'Jun 11, 2026', note: 'Add Over-Caution dimension + regression/guardrail cases (from failure review)', deltas: [
    '+ dimension: "Over-Caution Rate"',
    '+ case: "derivable-duration" (regression)',
    '+ case: "safety-missing-mtc" (guardrail)',
  ], snapshot: EVAL_RUBRIC_V2 },
  { version: 3, actor: ARTIFACT_ACTOR, timestamp: 'Jun 17, 2026', note: 'Reclassify scoring methods + add LLM-as-judge rubrics', deltas: [
    '~ "Claim-Citation Alignment" method: LLM-judge → RAGAS (model-graded)',
    '~ "Guideline Coverage" method: Deterministic → LLM-as-judge (rubric)',
    '+ dimension: "Context Precision" (RAGAS)',
    '+ dimension: "Clinical Argument Quality" (LLM-as-judge)',
    '+ dimension: "Tone & Empathy" (LLM-as-judge)',
    '+ dimension: "Medical Safety Language" (LLM-as-judge)',
  ], snapshot: EVAL_RUBRIC_V3 },
]

export function computeRubricDeltas(prev: EvalRubricData, next: EvalRubricData): string[] {
  const d = [
    ...diffList(prev.dimensions, next.dimensions, 'dimension', x => x.d),
    ...diffList(prev.cases, next.cases, 'case', x => x.id),
  ]
  return d.length ? d : ['No changes']
}

export function EvalRubricView({ setView, onOpenCase }: { setView: (v: View) => void; onOpenCase: (scenarioId: string, status: CaseStatus) => void }) {
  const vs = useVersioned<EvalRubricData>(EVAL_RUBRIC_HISTORY, [BLOCKED_EXPERIMENT])
  const data = vs.editing && vs.draft ? vs.draft : vs.current
  const deltas = vs.editing && vs.draft ? computeRubricDeltas(vs.current, vs.draft) : []
  const set = (patch: Partial<EvalRubricData>) => vs.setDraft(d => d ? { ...d, ...patch } : d)
  const [tab, setTab] = useState<RubricTab>('rubric')

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Eval Rubric</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            How the eval harness was chosen, what it measures, and how it gates the <button onClick={() => setView('evals')} className="text-emerald-400 hover:underline">Quality Report</button> — every prompt or model change runs through this
          </p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>

      {/* Tab bar */}
      <div className="px-8 pt-5">
        <div className="inline-flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1">
          {RUBRIC_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'runs' && (
        <div className="px-8 py-6">
          <EvalRunResultsPanel onOpenCase={onOpenCase} />
        </div>
      )}

      {tab === 'history' && (
        <div className="px-8 py-6">
          <VersionHistoryPanel title="Eval Rubric" versions={vs.versions} latestVersion={vs.latest.version} editing={vs.editing} onRevert={v => vs.revertTo(v, computeRubricDeltas)} experiments={vs.experiments} />
        </div>
      )}

      {tab === 'rubric' && (
      <div className="px-8 py-6 space-y-8">

        <div className="flex items-center justify-end">
          <ArtifactControls version={vs.latest.version} editing={vs.editing} onToggleHistory={() => setTab('history')} onEdit={vs.startEdit} />
        </div>

        {vs.justPublished !== null && !vs.editing && <JustPublishedBanner version={vs.justPublished} scope="The rubric now gates every client deployment." />}

        {/* Scoring dimensions */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Scoring Dimensions</h2>
          {vs.editing ? (
            <EditableRecordList
              items={data.dimensions}
              onChange={dimensions => set({ dimensions })}
              addLabel="Add dimension"
              blank={{ d: '', w: '', m: 'Deterministic', p: '100%' }}
              fields={[
                { key: 'd', placeholder: 'dimension', grow: 2 },
                { key: 'w', placeholder: 'what it checks', grow: 4 },
                { key: 'm', placeholder: 'method', grow: 2, options: ['Deterministic', 'RAGAS', 'LLM-as-judge', 'Red-team'] },
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
                  {data.dimensions.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{r.d}</td>
                      <td className="px-4 py-3 text-slate-400">{r.w}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs whitespace-nowrap ${methodColor(r.m)}`}>{r.m}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-emerald-300 whitespace-nowrap">{r.p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!vs.editing && <p className="text-xs text-slate-600 mt-2">Method reflects how much judgment the scorer exercises: <span className="text-sky-300">Deterministic</span> (rules) → <span className="text-emerald-300">RAGAS</span> (model-graded entailment) → <span className="text-violet-300">LLM-as-judge</span> (authored rubrics). The <button onClick={() => setView('failures')} className="text-emerald-400 hover:underline">failure review</button> feeds new cases back here.</p>}
        </div>

        {/* Authored rubric criteria — the LLM-as-judge dimensions, HealthBench-style */}
        {!vs.editing && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Authored Rubric Criteria <span className="text-violet-300 font-normal">· LLM-as-judge</span></h2>
            <p className="text-xs text-slate-500 mb-3">For subjective dimensions with no deterministic answer key, the AI Lead authors explicit pass criteria; an LLM grades each letter against them (HealthBench-style).</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {RUBRIC_DIMENSIONS.filter(d => d.criteria).map(d => (
                <div key={d.dimension} className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-violet-200">{d.dimension}</h3>
                    <span className="ml-auto font-mono text-xs text-slate-400">{d.grader} · {thresholdLabel(d.threshold)}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {d.criteria!.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                        <span className="text-violet-400 mt-0.5 shrink-0">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LLM-as-judge calibration — who validates the judge */}
        {!vs.editing && (
          <div>
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-violet-400" />Is the Judge Trustworthy? <span className="text-violet-300 font-normal">· LLM-as-judge calibration</span>
            </h2>
            <p className="text-xs text-slate-500 mb-3">An LLM grader only gets to gate clinical letters if it agrees with clinicians. The judge is calibrated against a clinician panel on a labeled sample — and the ambiguous tail still goes to a human.</p>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {[
                  { label: 'Judge ↔ clinician agreement', value: `${JUDGE_CALIBRATION.agreementPct}%`, sub: `on ${JUDGE_CALIBRATION.labeledLetters} labeled letters` },
                  { label: "Cohen's κ", value: JUDGE_CALIBRATION.cohenKappa.toFixed(2), sub: 'inter-rater · substantial' },
                  { label: 'Clinician panel', value: `${JUDGE_CALIBRATION.panelClinicians}`, sub: 'independent reviewers' },
                  { label: 'Last calibrated', value: JUDGE_CALIBRATION.lastCalibrated, sub: JUDGE_CALIBRATION.recalibrateOn },
                ].map(t => (
                  <div key={t.label} className="rounded-lg bg-slate-900/40 border border-slate-700/50 p-3">
                    <p className="text-xs font-medium text-slate-400 mb-1.5 leading-snug">{t.label}</p>
                    <p className="text-xl font-bold font-mono text-violet-200 leading-none">{t.value}</p>
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
        )}

        {/* Eval case set */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-1">Eval Case Set</h2>
          <p className="text-xs text-slate-500 mb-3">Representative cases — the full regression suite is <span className="font-mono text-slate-400">{SUITE_SIZE}</span> cases and grows as production failures graduate into it.</p>
          {vs.editing ? (
            <EditableRecordList
              items={data.cases}
              onChange={cases => set({ cases })}
              addLabel="Add eval case"
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
              {data.cases.map((c, i) => (
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
                </div>
              ))}
            </div>
          )}
        </div>

        {vs.editing && (
          <SandboxPromotionBar deltas={deltas} changeNote={vs.changeNote} setChangeNote={vs.setChangeNote} onPromote={r => vs.promote(deltas, r)} onDiscard={r => vs.discardExperiment(r)} />
        )}

        {/* Loop tie-in */}
        {!vs.editing && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
            <RotateCcw className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-400 leading-relaxed">
              The case set grows from production. Every reviewed failure becomes a new eval case (regression or guardrail), so a fixed
              failure can never silently return — the rubric is how improvements are made safe to ship across all clients.
            </p>
          </div>
        )}

      </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// View — Agent Instructions (illustrative, abridged instruction sets per node)
// ---------------------------------------------------------------------------
