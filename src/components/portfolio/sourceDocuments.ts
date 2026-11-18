import type { ScenarioConfig, SourceDocBlock, SourceDocument } from '../../types'

// Pure resolution helpers for the source-document viewer. Given the criterion a
// reviewer is standing on, find the document + block that grounds it so the
// viewer can switch tabs, scroll, and light the span. Unit-tested in
// sourceDocuments.test.ts, including a parity guard against the scenario data.

export function findCitedBlock(
  docs: SourceDocument[],
  criterionLabel: string,
): { docId: string; blockIndex: number } | null {
  for (const doc of docs) {
    const blockIndex = doc.blocks.findIndex(b => b.criterionLabel === criterionLabel)
    if (blockIndex !== -1) return { docId: doc.id, blockIndex }
  }
  return null
}

export function defaultDocId(docs: SourceDocument[]): string | null {
  return docs[0]?.id ?? null
}

// Returns authored sourceDocuments when present, or synthesizes structured
// chart documents directly from the scenario's verified citations and conflict
// excerpts so every patient case renders full source records in the right pane.
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
            text: `Clinical Record — ${cite.source} · Diagnosis: ${scenario.diagnosis} · Requested Therapy: ${scenario.requestedTherapy ?? scenario.drug}`,
          },
        ],
      }
      bySource.set(cite.source, entry)
    }
    entry.blocks.push({
      text: cite.text,
      criterionLabel: cr.rule.label,
    })

    if (cr.conflictSources?.length) {
      for (const cs of cr.conflictSources) {
        entry.blocks.push({ text: `${cs.source}: "${cs.claim}"` })
      }
    }
  }

  let idx = 0
  const docs: SourceDocument[] = []
  for (const [source, data] of bySource.entries()) {
    const slug = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    docs.push({
      id: `doc-${slug || idx}`,
      title: source,
      source,
      meta: `${data.page} · EHR record · ${scenario.plan}`,
      blocks: data.blocks,
    })
    idx += 1
  }

  if (scenario.payerCounterOffer) {
    docs.unshift({
      id: 'doc-payer-counter-offer',
      title: `${scenario.plan} — Partial Approval / Counter-Offer`,
      source: `${scenario.plan} Coverage Determination Letter`,
      meta: `${scenario.planId} · ${scenario.payerCounterOffer.date}`,
      blocks: [
        { text: scenario.payerCounterOffer.summary },
        { text: `Dosing determination: ${scenario.payerCounterOffer.newDenialReason}` },
        { text: `Approved dose: ${scenario.payerCounterOffer.approvedDose}` },
      ],
    })
  }

  return docs
}
