import type { AssessmentCitation, AssessmentCriterion, CaseAssessment } from '../../lib/wire'

export interface DescribedCitation {
  criterionId: string
  criterionStatus: AssessmentCriterion['status']
  requirement: string
  sourceVersionId: string
  shaShort: string
  start: number
  end: number
  role: AssessmentCitation['role']
  roleLabel: string
  isLocationOnly: boolean
  locationLabel: string
  excerptText: string | null
}

export interface AssessmentSourceDoc {
  sourceVersionId: string
  shaShort: string
  hasLocationOnly: boolean
  canonicalBody: string | null
  spans: DescribedCitation[]
}

export function sliceByCodePoints(body: string, start: number, end: number): string {
  return Array.from(body).slice(Math.max(0, start), Math.max(0, end)).join('')
}

export function describeAssessmentCitation(
  cite: AssessmentCitation,
  criterion: AssessmentCriterion,
  body?: string,
): DescribedCitation {
  const isLocationOnly = criterion.criterion_id === 'source_review' || cite.excerpt === null
  const sliced = !isLocationOnly && body ? sliceByCodePoints(body, cite.start, cite.end) : null
  return {
    criterionId: criterion.criterion_id,
    criterionStatus: criterion.status,
    requirement: criterion.requirement,
    sourceVersionId: cite.source_version_id,
    shaShort: cite.source_sha256.slice(0, 12),
    start: cite.start,
    end: cite.end,
    role: cite.role,
    roleLabel: cite.role === 'context' ? 'Context only (not proof)' : 'Patient record',
    isLocationOnly,
    locationLabel: `${cite.source_version_id} [${cite.start}..${cite.end})`,
    excerptText: isLocationOnly ? null : (cite.excerpt ?? sliced),
  }
}

export function buildAssessmentSourceDocs(
  assessment: CaseAssessment,
  sourceBodies?: Record<string, string>,
): AssessmentSourceDoc[] {
  const bySource = new Map<string, AssessmentSourceDoc>()
  for (const criterion of assessment.findings) {
    for (const cite of criterion.evidence) {
      const body = sourceBodies?.[cite.source_version_id]
      const described = describeAssessmentCitation(cite, criterion, body)
      let doc = bySource.get(cite.source_version_id)
      if (!doc) {
        doc = {
          sourceVersionId: cite.source_version_id,
          shaShort: described.shaShort,
          hasLocationOnly: false,
          canonicalBody: body ?? null,
          spans: [],
        }
        bySource.set(cite.source_version_id, doc)
      }
      if (described.isLocationOnly) {
        doc.hasLocationOnly = true
        // Never expose raw source body when the source carries a location-only row.
        doc.canonicalBody = null
      }
      doc.spans.push(described)
    }
  }
  return Array.from(bySource.values())
}

export function findDocForCriterion(
  docs: AssessmentSourceDoc[],
  criterionId: string | null,
): AssessmentSourceDoc | null {
  if (docs.length === 0) return null
  if (!criterionId) return docs[0]
  return docs.find(d => d.spans.some(s => s.criterionId === criterionId)) ?? docs[0]
}
