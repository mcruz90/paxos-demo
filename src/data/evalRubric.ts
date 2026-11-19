import { type EvalMethodology } from '../types'

// ---------------------------------------------------------------------------
// APPEAL-LETTER EVAL RUBRIC — aligned to clearauth-eval's data/appeal_rubric.json
// and clearauth-eval decision 0011:
//   Deterministic   — D1–D7 rule-based assertions (no model)
//   Entailment      — E1–E2 deterministic claim->citation gate & context precision
//   Advisory Judge  — J1–J4 defined anchored 1–4 rubrics; no judge runs yet
// ---------------------------------------------------------------------------

export interface RubricDimension {
  id: string
  dimension: string
  method: EvalMethodology
  grader: string
  measures: string
  threshold: number
  status: 'active' | 'not_built'
  criteria?: string[]
}

export const RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    id: 'D1_D5_D7_safety_gate',
    dimension: 'Safety Gate',
    method: 'Deterministic',
    grader: 'gatekeeper.assert',
    threshold: 1.0,
    status: 'active',
    measures: 'Rule-based gate (D1, D4, D5, D6, D7): product exact without sibling salt mixups, denial addressed, no refusal/hedging phrases, and zero raw identifiers on Build plane.',
  },
  {
    id: 'D2_D3_structure',
    dimension: 'Letter Structure',
    method: 'Deterministic',
    grader: 'appeal_eval.rubric.structure',
    threshold: 1.0,
    status: 'active',
    measures: 'Rule-based parse (D2, D3a, D3b): drug named at top, reconsideration request, NPI signature block, denial reason & denied criterion cited.',
  },
  {
    id: 'E1_claim_citation',
    dimension: 'Claim-Citation Alignment',
    method: 'Entailment',
    grader: 'citation_gate.verify',
    threshold: 0.85,
    status: 'active',
    measures: 'E1 deterministic claim->citation gate (ports/clearauth/citation_gate.py): every factual claim must resolve to a supporting span with zero conflicting values or ungrounded assertions.',
  },
  {
    id: 'E2_context_precision',
    dimension: 'Context Precision',
    method: 'Entailment',
    grader: 'rubric.context_precision',
    threshold: 0.80,
    status: 'active',
    measures: 'E2 share of chart-cited claims whose grounding span overlaps evidence for one of the active policy criteria.',
  },
  {
    id: 'J3_clinical_coverage',
    dimension: 'Guideline Coverage',
    method: 'Advisory Judge',
    grader: 'appeal_rubric.J3_clinical_coverage',
    threshold: 0.90,
    status: 'not_built',
    measures: 'Defined ordinal rubric (1–4, not yet run): whether the letter covers diagnosis, prior treatments & outcomes, and why this drug now.',
    criteria: [
      'Every PA criterion in the policy is explicitly addressed',
      'Prior treatments and outcomes ordered as a reviewer reads',
      'No criterion asserted without supporting evidence',
    ],
  },
  {
    id: 'J1_argument',
    dimension: 'Clinical Argument Quality',
    method: 'Advisory Judge',
    grader: 'appeal_rubric.J1_argument',
    threshold: 0.85,
    status: 'not_built',
    measures: 'Defined ordinal rubric (1–4, not yet run): connects cited facts to the denied criterion and anticipates the reviewer objection.',
    criteria: [
      'Specific denial reason is directly rebutted, not sidestepped',
      'Controlling clinical guideline named when applicable',
      'Concrete authorization request — drug, dose, and duration',
    ],
  },
  {
    id: 'J2_tone',
    dimension: 'Tone & Empathy',
    method: 'Advisory Judge',
    grader: 'appeal_rubric.J2_tone',
    threshold: 0.90,
    status: 'not_built',
    measures: 'Defined ordinal rubric (1–4, not yet run): professional, factual clinical register — neither adversarial nor pleading.',
    criteria: [
      'Professional and factual register throughout',
      'No pleading or adversarial phrasing toward payer',
      "Acknowledges the patient's clinical circumstances",
    ],
  },
  {
    id: 'J4_safety_language',
    dimension: 'Medical Safety Language',
    method: 'Advisory Judge',
    grader: 'appeal_rubric.J4_safety_language',
    threshold: 0.95,
    status: 'not_built',
    measures: 'Defined ordinal rubric (1–4, not yet run): avoids promising outcomes or making claims beyond approved labeling.',
    criteria: [
      'No outcome guarantees or overstated efficacy claims',
      'Known contraindications acknowledged where relevant',
      'States uncertainty clearly where evidence is incomplete',
    ],
  },
]

export interface JudgeCalibrationSpec {
  status: 'not_built'
  reviewedLetters: number
  proposedMinLetters: number
  proposedMinKappa: number
  method: string
  policy: string
}

export const JUDGE_CALIBRATION_SPEC: JudgeCalibrationSpec = {
  status: 'not_built',
  reviewedLetters: 0,
  proposedMinLetters: 50,
  proposedMinKappa: 0.6,
  method: "Quadratic-weighted Cohen's κ (appeal_eval/calibration.py)",
  policy: 'No LLM judge runs yet (Decision 0011). Judge dimensions remain strictly advisory until calibrated against clinician ratings on de-identified letters (proposed bar: κ ≥ 0.60 on ≥ 50 letters; owner decides).',
}

export const METHOD_LABEL: Record<EvalMethodology, string> = {
  Deterministic: 'Rule-based (no model)',
  Entailment: 'Deterministic claim->citation gate',
  'Advisory Judge': 'Defined 1–4 rubric · not run (advisory)',
  'Red-team': 'Adversarial probes',
}

export const thresholdLabel = (t: number) => (t >= 1 ? '100%' : `≥ ${Math.round(t * 100)}%`)
