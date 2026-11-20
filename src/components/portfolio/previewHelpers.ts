import { type CriterionResult, type ScenarioConfig } from '../../types'
import { type LocalCaseState } from './caseQueue'
import { type PatientProfileData } from './patient'

export type TaxonomyCode =
  | 'met'
  | 'reassessed_met'
  | 'records_needed'
  | 'not_documented'
  | 'exception_possible'
  | 'conflict'

export interface CriterionTaxonomy {
  code: TaxonomyCode
  label: string
}

export interface PathwayBranch {
  operator: 'MANDATORY GATE' | 'OR / BYPASS' | '≥2 OF 3' | 'ALL OF'
  badgeCls: string
}

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

export function classifyCriterionTaxonomy(
  criterion: CriterionResult,
  localState: LocalCaseState,
): CriterionTaxonomy {
  const label = criterion.rule.label
  if (localState.findingsDeltas?.[label] || localState.overrides[label] !== undefined) {
    return { code: 'reassessed_met', label: 'Addressed (Reassessed)' }
  }
  if (localState.dispatched.includes(label)) {
    return { code: 'records_needed', label: 'Records Requested' }
  }
  if (criterion.status === 'conflict') {
    return { code: 'conflict', label: 'Safety Contradiction' }
  }
  if (criterion.status === 'needs_review') {
    const lower = label.toLowerCase()
    if (lower.includes('preferred') || lower.includes('step')) {
      return { code: 'exception_possible', label: 'Exception Possible' }
    }
    if (criterion.workflowPlan) {
      return { code: 'records_needed', label: 'Records Needed' }
    }
    return { code: 'not_documented', label: 'Not Documented' }
  }
  return { code: 'met', label: 'Met' }
}

export function derivePathwayBranch(criterion: CriterionResult): PathwayBranch {
  if (criterion.rule.type === 'safety') {
    return { operator: 'MANDATORY GATE', badgeCls: 'bg-red-500/10 text-red-300 border-red-500/30' }
  }
  const label = criterion.rule.label
  if (/bypass|preferred-product|step therapy/i.test(label)) {
    return { operator: 'OR / BYPASS', badgeCls: 'bg-violet-500/10 text-violet-300 border-violet-500/30' }
  }
  if (/≥2 of 3/i.test(label)) {
    return { operator: '≥2 OF 3', badgeCls: 'bg-sky-500/10 text-sky-300 border-sky-500/30' }
  }
  return { operator: 'ALL OF', badgeCls: 'bg-slate-800/70 text-slate-400 border-slate-700' }
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
