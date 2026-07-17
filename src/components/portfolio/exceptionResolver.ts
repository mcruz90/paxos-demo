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
  policyNote: string // the gap / payer position being resolved
  options: ResolverEvidenceOption[]
  guidelineHits: ResolverGuidelineHit[]
  // The criterion's outbound workflow (fax / EHR task to the clinic), when one
  // exists. Rendered as a first-class resolution path — dispatching it IS the
  // resolution, so it is never a checkbox mixed in with evidence options.
  workflow?: WorkflowPlan
  // What a simulated EHR/registry pull can verify for this criterion — present
  // only when the scenario fixture documents it (never invented).
  ehrVerify?: EhrVerification
  // Suggested Q&A over the retrieved evidence (fixture-derived answers).
  docChat?: DocChatFixture
}

function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
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
      preselected: true,
    })
    options.push({
      id: 'guideline',
      title: `Clinical guideline (PMID ${round2.guidelinePMID})`,
      detail: `${round2.guidelineRef} — supports ${round2.requiredDose}.`,
      preselected: false,
    })
  }

  return {
    title: `Dispute payer counter-offer — ${scenario.drug}`,
    policyNote: `${offer.summary} ${offer.newDenialReason}`,
    options,
    guidelineHits: round2
      ? [{ ref: round2.guidelineRef, pmid: round2.guidelinePMID, url: pubmedUrl(round2.guidelinePMID), snippet: round2.keyArgument }]
      : [],
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
// evidence-backed justification. Presets come from the AI's suggestedAction
// and the criterion's outbound workflowPlan.
export function buildCriterionResolverContext(
  scenario: ScenarioConfig,
  criterion: CriterionResult,
): ResolverContext {
  const options: ResolverEvidenceOption[] = []
  if (criterion.suggestedAction) {
    options.push({
      id: 'suggested',
      title: 'Apply the suggested resolution',
      detail: criterion.suggestedAction,
      preselected: true,
    })
  }
  // EHR auto-verify: the finding becomes an attachable evidence option, but
  // never preselected — the operator attaches it after running the pull.
  const ehrVerify = scenario.ehrVerifications?.[criterion.rule.label]
  if (ehrVerify) {
    options.push({
      id: 'ehr',
      title: `EHR verification — ${ehrVerify.registry}`,
      detail: ehrVerify.finding,
      preselected: false,
    })
  }

  const round2 = scenario.round2Appeal
  return {
    title: `Resolve exception — ${criterion.rule.label}`,
    policyNote: criterion.note,
    options,
    guidelineHits: round2
      ? [{ ref: round2.guidelineRef, pmid: round2.guidelinePMID, url: pubmedUrl(round2.guidelinePMID), snippet: round2.keyArgument }]
      : [],
    workflow: criterion.workflowPlan,
    ehrVerify,
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
