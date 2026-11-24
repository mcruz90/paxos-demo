import type {
  AssessmentCitation,
  AssessmentCriterion,
  CaseAssessment,
} from '../../lib/wire'
import type { CriterionResult, CriterionStatus, RuleType, ScenarioConfig } from '../../types'
import { type LocalCaseState, countLocallyResolved, unresolvedCriteria } from './caseQueue'

export interface WiredCriterionMeta {
  criterionId: string
  backendStatus: AssessmentCriterion['status']
  requirement: string
  findingSummary: string
  nextAction: string | null
  isBlocker: boolean
  isLocationOnly: boolean
  patientEvidence: AssessmentCitation[]
  contextEvidence: AssessmentCitation[]
}

export interface AssessmentViewModel {
  revision: number
  criteria: CriterionResult[]
  ready: boolean
  readyLabel: string
  pathway: CaseAssessment['pathway']
  blockers: string[]
  nextAction: string | null
  ageYears: number | null
  metCount: number
  totalCount: number
}

export function mapAssessmentStatus(status: AssessmentCriterion['status']): CriterionStatus {
  if (status === 'met') return 'found'
  if (status === 'conflict') return 'conflict'
  return 'needs_review'
}

export function splitAssessmentEvidence(evidence: AssessmentCitation[]): {
  patientEvidence: AssessmentCitation[]
  contextEvidence: AssessmentCitation[]
} {
  return {
    patientEvidence: evidence.filter(c => c.role === 'patient'),
    contextEvidence: evidence.filter(c => c.role === 'context'),
  }
}

export function formatCriterionFinding(criterion: AssessmentCriterion): string {
  const { patientEvidence, contextEvidence } = splitAssessmentEvidence(criterion.evidence)
  const isLocationOnly =
    criterion.criterion_id === 'source_review' ||
    (patientEvidence.length > 0 && patientEvidence.every(c => c.excerpt === null))
  if (isLocationOnly) {
    const loc = patientEvidence.map(c => `${c.source_version_id} [${c.start}..${c.end})`).join(', ')
    return loc ? `Location only (${loc}) — no text.` : 'Location only — no text.'
  }
  const excerpts = patientEvidence.map(c => c.excerpt).filter((x): x is string => !!x)
  if (excerpts.length > 0) return excerpts.join(' ')
  if (contextEvidence.length > 0) {
    return 'No patient record finding documented (context evidence only — not proof).'
  }
  return 'No patient record finding documented.'
}

function inferRuleType(criterionId: string): RuleType {
  if (criterionId === 'diagnosis' || criterionId === 'age') return 'diagnostic'
  if (criterionId === 'feeding_tube' || criterionId === 'swallowing') return 'safety'
  if (criterionId === 'omeprazole' || criterionId === 'pantoprazole' || criterionId === 'rabeprazole') {
    return 'temporal'
  }
  return 'custom'
}

export function formatAssessmentReadinessLabel(assessment: CaseAssessment): string {
  if (assessment.pathway === 'no_pa_required') {
    return 'No PA required (under-6 auto-process)'
  }
  return assessment.ready ? 'Ready — not approved' : 'Blocked — review required'
}

export function formatAgeAtRequest(ageYears: number | null): string {
  return ageYears === null ? 'Age at request: Not determined' : `Age at request: ${ageYears} years`
}

export function buildAssessmentView(assessment: CaseAssessment): AssessmentViewModel {
  const blockerSet = new Set(assessment.blockers)
  const criteria: CriterionResult[] = assessment.findings.map(row => {
    const { patientEvidence, contextEvidence } = splitAssessmentEvidence(row.evidence)
    const isLocationOnly =
      row.criterion_id === 'source_review' ||
      (row.evidence.length > 0 && row.evidence.every(c => c.excerpt === null))
    const findingSummary = formatCriterionFinding(row)
    const docIds = [...new Set(row.evidence.map(c => c.source_version_id))]
    return {
      rule: { type: inferRuleType(row.criterion_id), label: row.criterion_id },
      status: mapAssessmentStatus(row.status),
      note: findingSummary,
      docSource: docIds.join(', ') || 'No source citation',
      suggestedAction: row.next_action ?? undefined,
      assessment: {
        criterionId: row.criterion_id,
        backendStatus: row.status,
        requirement: row.requirement,
        findingSummary,
        nextAction: row.next_action,
        isBlocker: blockerSet.has(row.criterion_id),
        isLocationOnly,
        patientEvidence,
        contextEvidence,
      },
    }
  })

  return {
    revision: assessment.revision,
    criteria,
    ready: assessment.ready,
    readyLabel: formatAssessmentReadinessLabel(assessment),
    pathway: assessment.pathway,
    blockers: assessment.blockers,
    nextAction: assessment.next_action,
    ageYears: assessment.age_years,
    metCount: assessment.findings.filter(f => f.status === 'met').length,
    totalCount: assessment.findings.length,
  }
}

export function deriveReadinessGate(
  assessment: CaseAssessment | null | undefined,
  scenario: ScenarioConfig,
  localState: LocalCaseState,
): boolean {
  if (assessment) return !assessment.ready
  const unresolved = unresolvedCriteria(scenario)
  return unresolved.length > 0 && countLocallyResolved(unresolved, localState) < unresolved.length
}
