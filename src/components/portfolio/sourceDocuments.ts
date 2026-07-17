import type { SourceDocument } from '../../types'

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
