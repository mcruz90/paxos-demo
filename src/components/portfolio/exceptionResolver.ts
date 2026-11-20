import type { CriterionResult, EhrVerification, ScenarioConfig, WorkflowPlan } from '../../types'

// ---------------------------------------------------------------------------
// Exception-resolver context — pure builders behind ExceptionResolverModal.
// Every evidence option and guideline hit is derived from researched scenario
// fixture data (round2Appeal, suggestedAction, workflowPlan); this module never
// invents clinical facts. The "discovery" the modal simulates only ever
// surfaces what the golden-set research already verified (demo-only rail —
// the real /api/discovery backend is unit O6, not built).
// ---------------------------------------------------------------------------

export interface ResolverEvidenceOption {
  id: string
  title: string
  detail: string
  preselected: boolean
}

export interface ResolverGuidelineHit {
  id: string
  category: string
  effectiveDate: string
  accessLevel: string
  ref: string     // full citation string
  pmid: string
  url: string     // real PubMed link — the PMID is real, so the URL is too
  snippet: string // the case-relevant passage the retrieval highlights
}

// Fixture-honest document Q&A: each suggested question maps to an answer drawn
// verbatim from researched fixture fields. Free-form questions are answered by
// the live retrieval backend (unit O6) — until then the demo rail says so
// instead of improvising.
export interface DocChatFixture {
  suggestions: { q: string; a: string }[]
}

export interface ResolverContext {
  title: string
  gapSummary: string
  policyNote: string // the gap / payer position being resolved
  options: ResolverEvidenceOption[]
  guidelineHits: ResolverGuidelineHit[]
  // The criterion's outbound workflow (fax / EHR task to the clinic), when one
  // exists. Rendered as a first-class resolution path — dispatching it IS the
  // resolution, so it is never a checkbox mixed in with evidence options.
  workflow?: WorkflowPlan
  // What a simulated local patient-record lookup surfaces — present only when
  // the scenario fixture documents it (never invented).
  ehrVerify?: EhrVerification
  // Suggested Q&A over the retrieved evidence (fixture-derived answers).
  docChat?: DocChatFixture
  // Side-by-side conflicting chart sources for contradiction criteria.
  conflictSources?: { source: string; claim: string }[]
}

export function summarizeGap(policyNote: string, maxChars = 115): string {
  const clean = policyNote.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const firstSentenceEnd = clean.search(/[.!?](?:\s|$)/)
  if (firstSentenceEnd >= 30 && firstSentenceEnd < maxChars) {
    return clean.slice(0, firstSentenceEnd + 1)
  }
  const clipped = clean.slice(0, maxChars - 1)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
}

function buildGuidelineHit(round2: NonNullable<ScenarioConfig['round2Appeal']>): ResolverGuidelineHit {
  const yearMatch = round2.guidelineRef.match(/\b(19|20)\d{2}\b/)
  return {
    id: `guideline:${round2.guidelinePMID}`,
    category: 'Clinical Guideline',
    effectiveDate: yearMatch?.[0] ?? 'Unspecified',
    accessLevel: 'Local golden-set corpus',
    ref: round2.guidelineRef,
    pmid: round2.guidelinePMID,
    url: pubmedUrl(round2.guidelinePMID),
    snippet: round2.keyArgument,
  }
}

// Dispute mode: the payer counter-offered (e.g. sub-therapeutic dose) and the
// operator assembles the round-2 evidence packet. Null when there is nothing
// to dispute.
export function buildDisputeResolverContext(scenario: ScenarioConfig): ResolverContext | null {
  const offer = scenario.payerCounterOffer
  if (!offer) return null
  const round2 = scenario.round2Appeal

  const options: ResolverEvidenceOption[] = []
  if (round2) {
    options.push({
      id: 'labeled-dose',
      title: `Labeled dosing supports ${round2.requiredDose}`,
      detail: round2.keyArgument,
      preselected: false,
    })
    options.push({
      id: `guideline:${round2.guidelinePMID}`,
      title: `Clinical guideline (PMID ${round2.guidelinePMID})`,
      detail: `${round2.guidelineRef} — supports ${round2.requiredDose}.`,
      preselected: false,
    })
  }

  const policyNote = `${offer.summary} ${offer.newDenialReason}`
  return {
    title: `Dispute payer counter-offer — ${scenario.drug}`,
    gapSummary: summarizeGap(policyNote),
    policyNote,
    options,
    guidelineHits: round2 ? [buildGuidelineHit(round2)] : [],
    docChat: round2
      ? {
          suggestions: [
            { q: 'What dose does the evidence support for this patient?',
              a: `${round2.requiredDose} — per ${round2.guidelineRef}` },
            { q: 'Why is the approved dose insufficient?',
              a: round2.keyArgument },
          ],
        }
      : undefined,
  }
}

// Criterion mode: a needs_review / conflict criterion is resolved with an
// evidence-backed justification. Options start unselected so clinicians
// explicitly attach reviewed evidence without overwriting source facts.
export function buildCriterionResolverContext(
  scenario: ScenarioConfig,
  criterion: CriterionResult,
): ResolverContext {
  const options: ResolverEvidenceOption[] = []
  if (criterion.suggestedAction) {
    options.push({
      id: 'suggested',
      title: 'Scenario Fixture Note (Suggested Follow-up)',
      detail: criterion.suggestedAction,
      preselected: false,
    })
  }
  const ehrVerify = scenario.ehrVerifications?.[criterion.rule.label]
  if (ehrVerify) {
    options.push({
      id: 'ehr',
      title: `Local fixture record — ${ehrVerify.registry}`,
      detail: ehrVerify.finding,
      preselected: false,
    })
  }

  const round2 = scenario.round2Appeal
  return {
    title: `Resolve exception — ${criterion.rule.label}`,
    gapSummary: summarizeGap(criterion.note),
    policyNote: criterion.note,
    options,
    guidelineHits: round2 ? [buildGuidelineHit(round2)] : [],
    workflow: criterion.workflowPlan,
    ehrVerify,
    conflictSources: criterion.conflictSources,
    docChat: ehrVerify
      ? {
          suggestions: [
            { q: `What does the ${ehrVerify.registry.toLowerCase()} show?`, a: ehrVerify.finding },
          ],
        }
      : undefined,
  }
}

// The justification recorded on the override / dispute: the selected preset
// details in option order, then any custom rationale. Empty when the operator
// selected and typed nothing — callers disable the apply action on that.
export function assembleJustification(
  ctx: ResolverContext,
  selectedIds: string[],
  customText: string,
): string {
  const parts = ctx.options.filter(o => selectedIds.includes(o.id)).map(o => o.detail)
  const custom = customText.trim()
  if (custom) parts.push(custom)
  return parts.join(' ')
}
