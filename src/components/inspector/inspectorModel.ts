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
