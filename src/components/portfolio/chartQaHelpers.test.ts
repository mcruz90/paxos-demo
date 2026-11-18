import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import { ensureSourceDocuments } from './sourceDocuments'
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
    expect(cmp!.orderedRegimen).toContain('20mg/day')
    expect(cmp!.payerOfferRegimen).toContain('10mg/day')
    expect(cmp!.guidelineFloor).toContain('NASPGHAN/ESPGHAN')
    expect(cmp!.payerOfferGap.length).toBeGreaterThan(10)
  })
})

describe('filterDocumentsByCategory and countDocumentsByCategory', () => {
  it('buckets held wrong-patient docs separately from labs/rx and clinical consults', () => {
    const docs = ensureSourceDocuments(scenarios['gilead-livdelzi'])
    const counts = countDocumentsByCategory(docs)
    expect(counts.all).toBe(docs.length)
    expect(counts.held).toBe(1)
    expect(counts.clinical + counts.labs_meds + counts.held).toBe(counts.all)

    const heldDocs = filterDocumentsByCategory(docs, 'held')
    expect(heldDocs).toHaveLength(1)
    expect(heldDocs[0].id).toBe('doc-misfiled-hold')

    expect(filterDocumentsByCategory(docs, 'all')).toHaveLength(docs.length)
  })
})
