import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import type { SourceDocument } from '../../types'
import {
  countDocumentsByCategory,
  deriveCounterOfferComparison,
  filterDocumentsByCategory,
} from './chartQaHelpers'

describe('deriveCounterOfferComparison', () => {
  it('returns null when scenario has no payer counter-offer', () => {
    expect(deriveCounterOfferComparison(scenarios['gilead-livdelzi'])).toBeNull()
  })

  it('extracts prescribed vs counter-offer regimen comparison for pediatric-esomeprazole', () => {
    const cmp = deriveCounterOfferComparison(scenarios['pediatric-esomeprazole'])
    expect(cmp).not.toBeNull()
    expect(cmp!.orderedRegimen).toContain('56 days')
    expect(cmp!.payerOfferRegimen).toContain('28 of 56 days')
    expect(cmp!.guidelineFloor).toContain('12 months')
    expect(cmp!.payerOfferGap.length).toBeGreaterThan(10)
  })
})

describe('filterDocumentsByCategory and countDocumentsByCategory', () => {
  it('buckets held wrong-patient docs separately from labs/rx and clinical consults', () => {
    const docs: SourceDocument[] = [
      { id: 'doc-consult', title: 'Consult', source: 'Hepatology Consult', meta: 'p.1', blocks: [{ text: 'note' }] },
      { id: 'doc-lab', title: 'Labs', source: 'Lab Report', meta: 'p.2', blocks: [{ text: 'lab' }] },
      {
        id: 'doc-held',
        title: 'Misfiled Lab',
        source: 'Reference Lab',
        meta: 'p.4',
        blocks: [{ text: 'other patient' }],
        patientMismatchHold: { detectedName: 'Other Patient', expectedName: 'Diane Okafor', reason: 'Header mismatch' },
      },
    ]
    const counts = countDocumentsByCategory(docs)
    expect(counts).toEqual({ all: 3, clinical: 1, labs_meds: 1, held: 1 })
    expect(counts.clinical + counts.labs_meds + counts.held).toBe(counts.all)

    const heldDocs = filterDocumentsByCategory(docs, 'held')
    expect(heldDocs).toHaveLength(1)
    expect(heldDocs[0].id).toBe('doc-held')

    expect(filterDocumentsByCategory(docs, 'all')).toHaveLength(3)
  })
})
