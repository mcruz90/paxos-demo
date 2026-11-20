import { type EvalMethodology } from '../types'
import { METHOD_LABEL, RUBRIC_DIMENSIONS } from './evalRubric'

// Non-numeric rubric methodology descriptors (all eval numbers come exclusively
// from eval_snapshot.json schema v2).
export const GRADERS = RUBRIC_DIMENSIONS.map(d => ({
  methodology: d.method,
  dimension: d.dimension,
  grader: d.grader,
  method: METHOD_LABEL[d.method],
  threshold: d.threshold,
  measures: d.measures,
  status: d.status,
  criteria: d.criteria,
}))

export const METHODOLOGY_META: Record<EvalMethodology, { blurb: string; accent: string; method: string }> = {
  Deterministic: { blurb: 'Rule-based gatekeeper — safety gate, product match, and letter structure (D1–D7).', accent: 'sky', method: METHOD_LABEL.Deterministic },
  Entailment: { blurb: 'Deterministic claim->citation verification and policy-context overlap (E1–E2).', accent: 'emerald', method: METHOD_LABEL.Entailment },
  'Advisory Judge': { blurb: 'Ordinal 1–4 rubric (J1–J4) defined in appeal_rubric.json — no judge runner active yet.', accent: 'violet', method: METHOD_LABEL['Advisory Judge'] },
  'Red-team': { blurb: 'Adversarial probes — PHI-leak, prompt-injection, and unsupported-claim resistance.', accent: 'amber', method: METHOD_LABEL['Red-team'] },
}
