import { type CriterionResult } from '../../types'
import { type AttachedExcerpt, type LocalCaseState, logActivity } from './caseQueue'

// Step 1 of two-step evidence resolution: attach reviewed source excerpts to
// a criterion without changing its status or counting it as resolved.
export function attachExcerptsOnly(
  local: LocalCaseState,
  ruleLabel: string,
  excerpts: AttachedExcerpt[],
  at: string,
): LocalCaseState {
  const prevAttached = local.attachedExcerpts?.[ruleLabel] ?? []
  const merged = [...prevAttached]
  for (const item of excerpts) {
    if (!merged.some(existing => existing.id === item.id)) {
      merged.push(item)
    }
  }
  const next: LocalCaseState = {
    ...local,
    attachedExcerpts: { ...(local.attachedExcerpts ?? {}), [ruleLabel]: merged },
  }
  return logActivity(next, {
    at,
    action: 'Evidence excerpt attached (provisional — awaiting reassessment)',
    detail: `${ruleLabel} · ${merged.length} item(s) staged without altering readiness`,
  })
}

// Step 2 of two-step evidence resolution: explicitly reassess the criterion
// with attached evidence and clinician rationale, preserving prior chart facts
// and recording an explicit Findings Delta instead of silently overwriting.
export function reassessCriterionWithDelta(
  local: LocalCaseState,
  criterion: CriterionResult,
  excerpts: AttachedExcerpt[],
  rationale: string,
  at: string,
): LocalCaseState {
  const label = criterion.rule.label
  const priorAttached = local.attachedExcerpts?.[label] ?? []
  const merged = excerpts.length > 0 ? excerpts : priorAttached
  const trimmedRationale = rationale.trim()

  const next: LocalCaseState = {
    ...local,
    attachedExcerpts: { ...(local.attachedExcerpts ?? {}), [label]: merged },
    overrides: { ...local.overrides, [label]: trimmedRationale },
    findingsDeltas: {
      ...(local.findingsDeltas ?? {}),
      [label]: {
        priorStatus: criterion.status,
        priorNote: criterion.note,
        reassessedStatus: 'reassessed_met',
        attachedCount: merged.length,
        rationale: trimmedRationale,
        at,
      },
    },
  }

  return logActivity(next, {
    at,
    action: 'Criterion reassessed (findings delta recorded)',
    detail: `${label}: ${criterion.status} → reassessed_met (${merged.length} attached)`,
    artifact: {
      title: `Reassessment delta — ${label}`,
      body: `Prior (${criterion.status}): ${criterion.note}\nAttached (${merged.length}): ${merged.map(e => e.title).join(', ') || 'None'}\nRationale: ${trimmedRationale}`,
    },
  })
}
