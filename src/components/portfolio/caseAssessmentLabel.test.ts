import { describe, expect, it } from 'vitest'
import type { components } from '../../generated/api-types'
import { formatAssessmentReadinessLabel } from './caseAssessment'

type CaseAssessment = components['schemas']['CaseAssessment']

function assessment(fields: Pick<CaseAssessment, 'pathway' | 'ready'>): CaseAssessment {
  return fields as CaseAssessment
}

// G-06 review R1: the age rule lives in the backend, so the readiness label
// (shown in the patient profile) must not name it.
describe('formatAssessmentReadinessLabel', () => {
  it('labels no_pa_required neutrally, without the under-6 rule', () => {
    const label = formatAssessmentReadinessLabel(assessment({ pathway: 'no_pa_required', ready: true }))
    expect(label).toBe('No PA required for this request')
    expect(label).not.toMatch(/under-6|auto-process/i)
  })

  it('keeps ready and blocked labels unchanged', () => {
    expect(formatAssessmentReadinessLabel(assessment({ pathway: 'swallowing', ready: true }))).toBe(
      'Ready — not approved',
    )
    expect(formatAssessmentReadinessLabel(assessment({ pathway: 'swallowing', ready: false }))).toBe(
      'Blocked — review required',
    )
  })
})
