import type { DoneEvent } from '../../lib/wire'
import type { CaseTier, ScenarioConfig } from '../../types'

export type GateStatus = 'pass' | 'fail' | 'not_evaluated'

export interface GateAssertion {
  key: string
  label: string
  status: GateStatus
  value: string
  targetCiteIndex?: number
}

export interface RunMetadata {
  correlationId: string
  artifactRef: string
  model: string
  resolution: string
  tier: CaseTier | null
  isSimulated: boolean
}

export interface ClearauthEvalStageSummary {
  stage: string
  module: string
  n: number
  scorePct: number
  ci95: string
  note: string
}

export const CLEARAUTH_EVAL_STAGES: ClearauthEvalStageSummary[] = [
  { stage: '1. Doc Type', module: 'doc_type_eval', n: 180, scorePct: 97.2, ci95: '93.6%–98.9%', note: 'Negated approval & first-person appeal rules' },
  { stage: '2. Intake + Fallback', module: 'intake_eval + llm_fallback', n: 342, scorePct: 96.5, ci95: '93.9%–98.1%', note: '0 silent errors across 342 held-out gaps' },
  { stage: '3. De-Identification', module: 'deid_eval', n: 120, scorePct: 98.3, ci95: '94.1%–99.7%', note: 'Unicode normalization + residual.held enforcement' },
  { stage: '4. Drug Identity', module: 'rxnorm', n: 96, scorePct: 95.8, ci95: '89.7%–98.4%', note: 'Offline RxCUI & release-form matching' },
  { stage: '5. Chart Criteria Tree', module: 'chart_eval', n: 300, scorePct: 99.4, ci95: '97.7%–99.9%', note: 'AND/OR criteria tree & specialist token checks' },
  { stage: '6. Appeal Citation Gate', module: 'appeal_eval', n: 84, scorePct: 94.0, ci95: '86.7%–97.4%', note: 'Deterministic claim→citation gate (demo subset)' },
]

export const DUAL_REVIEWER_KAPPA = {
  sampleCriteria: 82,
  agreementPct: 96.3,
  kappa: 0.84,
  targetKappa: 0.8,
  stage5Ready: true,
  graduatedEdits: 14,
} as const

export function buildGateAssertions(
  doneScores: Record<string, number> | undefined,
  scenario: ScenarioConfig,
): GateAssertion[] {
  const conflictIdx = scenario.criteriaResults.findIndex(cr => cr.status === 'conflict')
  const openIdx = scenario.criteriaResults.findIndex(cr => cr.status !== 'found')

  if (doneScores) {
    return [
      ...Object.entries(doneScores).map(([key, score]) => ({
        key,
        label: key,
        status: (score >= 1 ? 'pass' : 'fail') as GateStatus,
        value: score >= 1 ? `PASS (${score})` : `FAIL (${score})`,
      })),
      { key: 'no_phi_leakage', label: 'no_phi_leakage', status: 'not_evaluated', value: 'not evaluated' },
    ]
  }

  return [
    { key: 'drug_name_present', label: 'drug_name_present', status: 'not_evaluated', value: 'not evaluated' },
    { key: 'diagnosis_present', label: 'diagnosis_present', status: 'not_evaluated', value: 'not evaluated', targetCiteIndex: 0 },
    {
      key: 'safety_conflict_check',
      label: 'safety_conflict_check',
      status: 'not_evaluated',
      value: 'not evaluated',
      targetCiteIndex: conflictIdx >= 0 ? conflictIdx : undefined,
    },
    {
      key: 'criteria_grounded',
      label: 'criteria_grounded',
      status: 'not_evaluated',
      value: 'not evaluated',
      targetCiteIndex: openIdx >= 0 ? openIdx : 0,
    },
    { key: 'no_phi_leakage', label: 'no_phi_leakage', status: 'not_evaluated', value: 'not evaluated' },
  ]
}

export function buildRunMetadata(done?: DoneEvent | null): RunMetadata {
  if (!done) {
    return {
      correlationId: 'not evaluated',
      artifactRef: 'not evaluated',
      model: 'not evaluated',
      resolution: 'not evaluated',
      tier: null,
      isSimulated: true,
    }
  }
  return {
    correlationId: done.correlation_id || 'not evaluated',
    artifactRef: done.ref || 'not evaluated',
    model: done.model || 'not evaluated',
    resolution: done.pa_resolution || 'not evaluated',
    tier: done.tier ?? null,
    isSimulated: false,
  }
}
