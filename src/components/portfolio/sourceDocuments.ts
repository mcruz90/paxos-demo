import type { ScenarioConfig, SourceDocBlock, SourceDocument } from '../../types'

// Pure resolution helpers for the source-document viewer. Skips any document
// held back due to a patient identifier mismatch (HANDOFF_CLEARAUTH.md §5.2).
export function findCitedBlock(
  docs: SourceDocument[],
  criterionLabel: string,
): { docId: string; blockIndex: number } | null {
  for (const doc of docs) {
    if (doc.patientMismatchHold) continue
    const blockIndex = doc.blocks.findIndex(b => b.criterionLabel === criterionLabel)
    if (blockIndex !== -1) return { docId: doc.id, blockIndex }
  }
  return null
}

export function defaultDocId(docs: SourceDocument[]): string | null {
  return docs[0]?.id ?? null
}

export function flagMisfiledPages(
  docs: SourceDocument[],
  expectedPatientName?: string,
): SourceDocument[] {
  if (!expectedPatientName) return docs
  const expectedLower = expectedPatientName.toLowerCase()
  return docs.map(doc => {
    if (doc.patientMismatchHold) return doc
    const headerMatch = doc.blocks
      .map(b => b.text.match(/\bPatient:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/)?.[1])
      .find(Boolean)
    if (headerMatch && !headerMatch.toLowerCase().includes(expectedLower) && !expectedLower.includes(headerMatch.toLowerCase())) {
      return {
        ...doc,
        patientMismatchHold: {
          detectedName: headerMatch,
          expectedName: expectedPatientName,
          reason: 'Header identifier mismatch — excluded from criteria grounding (HANDOFF §5.2)',
        },
      }
    }
    return doc
  })
}

// Returns authored sourceDocuments when present, or builds citation-excerpt
// views from scenario citations so cases without full source records are
// labeled honestly without fabricating extra documents.
export function ensureSourceDocuments(scenario: ScenarioConfig): SourceDocument[] {
  if (scenario.sourceDocuments && scenario.sourceDocuments.length > 0) {
    return scenario.sourceDocuments
  }

  const bySource = new Map<string, { page: string; blocks: SourceDocBlock[] }>()
  for (const cr of scenario.criteriaResults) {
    const cite = scenario.citations[cr.rule.label]
    if (!cite) continue
    let entry = bySource.get(cite.source)
    if (!entry) {
      entry = {
        page: cite.page,
        blocks: [
          {
            text: `Citation Excerpt (${cite.source}) — no full source document on file · Diagnosis: ${scenario.diagnosis} · Requested Therapy: ${scenario.requestedTherapy ?? scenario.drug}`,
          },
        ],
      }
      bySource.set(cite.source, entry)
    }
    entry.blocks.push({ text: cite.text, criterionLabel: cr.rule.label })
    if (cr.conflictSources?.length) {
      for (const cs of cr.conflictSources) {
        entry.blocks.push({ text: `${cs.source}: "${cs.claim}"` })
      }
    }
  }

  const docs: SourceDocument[] = Array.from(bySource.entries()).map(([source, data], idx) => {
    const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return {
      id: `doc-${slug || idx}`,
      title: source,
      source,
      meta: `${data.page} · Citation excerpt (no full document) · ${scenario.plan}`,
      blocks: data.blocks,
    }
  })

  if (scenario.payerCounterOffer) {
    docs.unshift({
      id: 'doc-payer-counter-offer',
      title: `${scenario.plan} — Partial Approval / Counter-Offer`,
      source: `${scenario.plan} Coverage Determination Letter`,
      meta: `${scenario.planId} · Citation excerpt (no full document) · ${scenario.payerCounterOffer.date}`,
      blocks: [
        { text: `Citation Excerpt — no full source document on file: ${scenario.payerCounterOffer.summary}` },
        { text: `Dosing determination: ${scenario.payerCounterOffer.newDenialReason}` },
        { text: `Approved dose: ${scenario.payerCounterOffer.approvedDose}` },
      ],
    })
  }

  return docs
}
