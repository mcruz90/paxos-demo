import { type CaseStatus, type ScenarioConfig } from '../../types'
import { type LocalCaseState, allExceptionsResolved, statusAfterResolution } from './caseQueue'

export interface ExplicitCaseTransition {
  nextStatus: CaseStatus
  actionLabel: string
  summary: string
}

// Pure transition proposal shown only after all clinical exceptions resolve
// locally. Case status never auto-transitions; the coordinator confirms the
// named move explicitly via CaseActionFooter.
export function resolveExplicitCaseTransition(
  clientStatus: CaseStatus,
  scenario: ScenarioConfig,
  local: LocalCaseState,
): ExplicitCaseTransition | null {
  if (clientStatus !== 'exception' || !allExceptionsResolved(scenario, local)) {
    return null
  }
  const nextStatus = statusAfterResolution(local)
  if (nextStatus === 'awaiting_documentation') {
    return {
      nextStatus,
      actionLabel: 'Move to Awaiting Documentation',
      summary: 'All exceptions addressed locally. Confirm moving this case to Awaiting Documentation.',
    }
  }
  return {
    nextStatus: 'ready_for_review',
    actionLabel: 'Move to Ready for Review',
    summary: 'All exceptions addressed locally. Confirm moving this case to Ready for Review.',
  }
}
