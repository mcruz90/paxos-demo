import { describe, it, expect } from 'vitest'
import { scenarios } from '../../data/scenarios'
import {
  assembleJustification,
  buildCriterionResolverContext,
  buildDisputeResolverContext,
} from './exceptionResolver'

// Canonical demo fixtures — never duplicated ad hoc (CLAUDE.md DRY rule).
const esomeprazole = scenarios['pediatric-esomeprazole']
const humira = scenarios['humira-cigna']
const ozempic = scenarios['novo-ozempic']

describe('buildDisputeResolverContext', () => {
  it('builds the dosing-dispute context from the payer counter-offer + round-2 fixture', () => {
    const ctx = buildDisputeResolverContext(esomeprazole)!
    expect(ctx).not.toBeNull()
    expect(ctx.policyNote).toContain('10mg/day')
    // Evidence options come from the researched round2Appeal data, not invention
    expect(ctx.options.length).toBeGreaterThanOrEqual(2)
    expect(ctx.options.some(o => o.detail.includes('20mg'))).toBe(true)
  })

  it('surfaces the real guideline citation as a discoverable hit (PMID from fixture)', () => {
    const ctx = buildDisputeResolverContext(esomeprazole)!
    expect(ctx.guidelineHits).toHaveLength(1)
    expect(ctx.guidelineHits[0].pmid).toBe('29470322')
    expect(ctx.guidelineHits[0].ref).toContain('NASPGHAN')
    // Real PMID ⇒ real, clickable PubMed URL for the clinician to read in full
    expect(ctx.guidelineHits[0].url).toBe('https://pubmed.ncbi.nlm.nih.gov/29470322/')
  })

  it('builds doc-chat suggestions from the researched fixture, never invention', () => {
    const ctx = buildDisputeResolverContext(esomeprazole)!
    expect(ctx.docChat).toBeDefined()
    const answers = ctx.docChat!.suggestions.map(s => s.a).join(' ')
    // Every answer traces to round2Appeal fixture fields
    expect(answers).toContain(esomeprazole.round2Appeal!.requiredDose)
    expect(answers).toContain(esomeprazole.round2Appeal!.keyArgument)
  })

  it('criterion mode offers doc-chat only when the fixture documents an EHR finding', () => {
    const humCrit = humira.criteriaResults.find(c => c.status === 'needs_review')!
    const humCtx = buildCriterionResolverContext(humira, humCrit)
    expect(humCtx.docChat?.suggestions.some(s => s.a === humCtx.ehrVerify!.finding)).toBe(true)

    const ozCrit = ozempic.criteriaResults.find(c => c.status === 'needs_review')!
    expect(buildCriterionResolverContext(ozempic, ozCrit).docChat).toBeUndefined()
  })

  it('returns null when the scenario has no counter-offer to dispute', () => {
    expect(buildDisputeResolverContext(ozempic)).toBeNull()
  })
})

describe('buildCriterionResolverContext', () => {
  it('builds a criterion context from the suggestedAction + workflowPlan', () => {
    const crit = humira.criteriaResults.find(c => c.status === 'needs_review')!
    const ctx = buildCriterionResolverContext(humira, crit)
    expect(ctx.title).toContain(crit.rule.label)
    expect(ctx.policyNote).toBe(crit.note)
    // suggestedAction becomes a preset option; workflowPlan becomes the
    // first-class dispatch path (not a checkbox — it resolves by itself)
    expect(ctx.options.some(o => o.detail === crit.suggestedAction)).toBe(true)
    expect(ctx.workflow).toEqual(crit.workflowPlan)
  })

  it('dispute mode has no dispatch path — a counter-offer is argued, not faxed away', () => {
    expect(buildDisputeResolverContext(esomeprazole)!.workflow).toBeUndefined()
  })

  it('yields no guideline hits when the scenario carries no researched guideline fixture', () => {
    const crit = humira.criteriaResults.find(c => c.status === 'needs_review')!
    expect(buildCriterionResolverContext(humira, crit).guidelineHits).toHaveLength(0)
  })

  it('surfaces the EHR auto-verify rail only where the fixture documents it', () => {
    // Humira: the researched fixture documents the biosimilar trial/failure —
    // a pharmacy-dispense pull can verify it, so the rail is available and its
    // finding becomes an attachable (not preselected) evidence option.
    const crit = humira.criteriaResults.find(c => c.status === 'needs_review')!
    const ctx = buildCriterionResolverContext(humira, crit)
    expect(ctx.ehrVerify).toBeDefined()
    const ehrOpt = ctx.options.find(o => o.id === 'ehr')!
    expect(ehrOpt.detail).toBe(ctx.ehrVerify!.finding)
    expect(ehrOpt.preselected).toBe(false)

    // Ozempic: the gap needs a prescriber attestation — no discrete EHR value
    // can satisfy it, so the rail is honestly absent.
    const ozCrit = ozempic.criteriaResults.find(c => c.status === 'needs_review')!
    const ozCtx = buildCriterionResolverContext(ozempic, ozCrit)
    expect(ozCtx.ehrVerify).toBeUndefined()
    expect(ozCtx.options.find(o => o.id === 'ehr')).toBeUndefined()
  })
})

describe('assembleJustification', () => {
  const ctx = buildDisputeResolverContext(esomeprazole)!

  it('joins the selected option details in order', () => {
    const ids = ctx.options.slice(0, 2).map(o => o.id)
    const out = assembleJustification(ctx, ids, '')
    expect(out).toContain(ctx.options[0].detail)
    expect(out).toContain(ctx.options[1].detail)
  })

  it('appends trimmed custom text and ignores unselected options', () => {
    const out = assembleJustification(ctx, [], '  custom rationale  ')
    expect(out).toBe('custom rationale')
  })

  it('returns empty string when nothing is selected or typed', () => {
    expect(assembleJustification(ctx, [], '   ')).toBe('')
  })
})
