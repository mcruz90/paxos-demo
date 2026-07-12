import { ArrowDown, FlaskConical } from 'lucide-react'
import { type RuleType } from '../types'
import { scenarios, universalPrimitives } from '../data/scenarios'
import { JsonView } from './jsonView'

// Rule-primitive example run (the detail pane of the primitives master-detail).
// Answers "how does a rule + its params become a CriterionResult at the
// Documentation stage?" — the gap between the abstract Documentation schema
// (criterion_results[]) and the concrete rules. The instance (params filled) is
// an illustrative example; the CriterionResult output is grounded in a real
// golden-set criterion of that type (real status + citation). No live inference.

// Illustrative filled-in instance per rule type — example inputs, drawn from the
// golden-set domain (PBC/Livdelzi, T2DM/Ozempic, pediatric GERD).
const INSTANCE_EXAMPLE: Record<RuleType, Record<string, unknown>> = {
  diagnostic: { condition_category: 'T2DM (E11.x)', must_be_present: true },
  math:       { biomarker_name: 'ALP', operator: '>', multiplier_of_uln: 1.0, max_age_days: 90 },
  temporal:   { intervention_target: 'UDCA', minimum_duration_days: 365, allows_intolerance_bypass: true },
  safety:     { condition_category: 'Hepatic decompensation', must_be_present: false },
  provider:   { required_specialty: 'Hepatology', must_be_ordering_provider: true, accepts_cosignature: true },
  quantity:   { dose_unit: 'mg', min_dose: 10, max_dose: 20, weight_based: false, max_supply_days: 30 },
  custom:     { rule: 'custom predicate', must_hold: true },
}

// Find a real criterion of this rule type in the golden set to ground the output;
// prefer one with a citation.
function groundedCriterion(type: RuleType) {
  const all = Object.values(scenarios).flatMap(s => s.criteriaResults.map(cr => ({ cr, s })))
  return all.find(({ cr, s }) => cr.rule.type === type && s.citations[cr.rule.label])
    ?? all.find(({ cr }) => cr.rule.type === type)
    ?? null
}

export function PrimitiveRunPanel({ type }: { type: RuleType }) {
  const prim = universalPrimitives.find(p => p.type === type) ?? universalPrimitives[0]
  const instance = INSTANCE_EXAMPLE[prim.type] ?? {}
  const match = groundedCriterion(prim.type)

  const resultData = match && (() => {
    const cite = match.s.citations[match.cr.rule.label]
    return {
      criterion: match.cr.rule.label,
      status: match.cr.status,
      ...(match.cr.confidence !== undefined ? { confidence: match.cr.confidence } : {}),
      citation: cite ? { source: cite.source, page: cite.page, quote: cite.text } : null,
    }
  })()

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-white mb-1">
        <FlaskConical className="w-4 h-4 text-emerald-400" />Example run
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-snug">
        How <span className="text-slate-400">{prim.name}</span> + its params becomes one <span className="font-mono text-slate-400">CriterionResult</span> in the Documentation stage&rsquo;s <span className="font-mono text-slate-400">criterion_results[]</span>. Instance is illustrative; output is a real golden-set criterion.
      </p>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        Instance · {prim.schemaClass.split(' ')[0]} <span className="text-slate-600 normal-case font-normal">· illustrative</span>
      </p>
      <JsonView data={instance} />

      <div className="flex items-center gap-2 text-slate-600 my-2">
        <div className="h-px flex-1 bg-slate-800" />
        <ArrowDown className="w-3.5 h-3.5" />
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        CriterionResult {match ? <span className="text-slate-600 normal-case font-normal">· real case ({match.s.drug.split(' ')[0]})</span> : <span className="text-slate-600 normal-case font-normal">· illustrative</span>}
      </p>
      {resultData
        ? <JsonView schema="CriterionResult" data={resultData} />
        : <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-3 text-[11px] text-slate-500">No golden-set criterion of this type yet — at Documentation it yields a <span className="font-mono">CriterionResult</span> with the criterion&rsquo;s status and citation.</div>}
    </div>
  )
}
