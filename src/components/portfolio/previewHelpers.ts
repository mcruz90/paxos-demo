import { type CriterionResult, type ScenarioConfig } from '../../types'
import { type LocalCaseState } from './caseQueue'
import { type PatientProfileData } from './patient'

export function sortCriteriaForReview(
  criteriaResults: CriterionResult[],
  localState: LocalCaseState,
): { criterion: CriterionResult; origIdx: number }[] {
  const rank = (c: CriterionResult) => {
    const isResolved =
      localState.overrides[c.rule.label] !== undefined ||
      localState.dispatched.includes(c.rule.label)
    if (isResolved || c.status === 'found') return 2
    return c.status === 'conflict' ? 0 : 1
  }
  return criteriaResults
    .map((criterion, origIdx) => ({ criterion, origIdx }))
    .sort((a, b) => rank(a.criterion) - rank(b.criterion))
}

export function buildQaSuggestions(
  scenario: ScenarioConfig,
  profile?: PatientProfileData,
): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = []
  if (profile?.trials?.length && profile.compliance) {
    out.push({
      q: 'Verify prior therapy trial',
      a: `${profile.trials.length} records in profile fixture (e.g. ${profile.trials[0].therapy}, ${profile.trials[0].facility}); PDC ${profile.compliance.pdc} over ${profile.compliance.durationDays} days.`,
    })
  }
  if (profile?.clinical?.diagnoses.length) {
    const dx = profile.clinical.diagnoses[0]
    out.push({
      q: 'Confirm primary diagnosis',
      a: `${dx.label}${dx.code ? ` (${dx.code})` : ''}${dx.since ? `, documented since ${dx.since}` : ''}.`,
    })
  }
  const firstCrit = scenario.criteriaResults[0]
  if (firstCrit) {
    const cite = scenario.citations[firstCrit.rule.label]
    if (cite) {
      out.push({ q: `Summarize ${firstCrit.docSource}`, a: `${cite.source} (${cite.page}): "${cite.text}"` })
    }
  }
  return out
}
