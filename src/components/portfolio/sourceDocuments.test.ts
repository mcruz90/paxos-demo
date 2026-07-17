import { describe, it, expect } from 'vitest'
import { scenarios } from '../../data/scenarios'
import type { SourceDocument } from '../../types'
import { defaultDocId, findCitedBlock } from './sourceDocuments'

const DOCS: SourceDocument[] = [
  {
    id: 'doc-a', title: 'A', source: 'Specialist Consult', meta: 'p.1',
    blocks: [
      { text: 'intro' },
      { text: 'the dx span', criterionLabel: 'Diagnosis' },
    ],
  },
  {
    id: 'doc-b', title: 'B', source: 'Medication List', meta: 'p.3',
    blocks: [
      { text: 'the meds span', criterionLabel: 'No Concomitant Agent' },
    ],
  },
]

describe('findCitedBlock', () => {
  it('locates the doc + block index whose criterionLabel matches', () => {
    expect(findCitedBlock(DOCS, 'Diagnosis')).toEqual({ docId: 'doc-a', blockIndex: 1 })
    expect(findCitedBlock(DOCS, 'No Concomitant Agent')).toEqual({ docId: 'doc-b', blockIndex: 0 })
  })

  it('returns null for a label no block grounds', () => {
    expect(findCitedBlock(DOCS, 'Unmatched Criterion')).toBeNull()
  })

  it('returns null for empty documents', () => {
    expect(findCitedBlock([], 'Diagnosis')).toBeNull()
  })
})

describe('defaultDocId', () => {
  it('returns the first document id', () => {
    expect(defaultDocId(DOCS)).toBe('doc-a')
  })
  it('returns null when there are no documents', () => {
    expect(defaultDocId([])).toBeNull()
  })
})

// Parity guard: for any golden scenario that authored sourceDocuments, every
// cited block must correspond to a real criterion, AND every criterion that has
// a citation must resolve to a cited block — otherwise a criterion would select
// nothing in the viewer, or a span would light for a criterion that doesn't
// exist. This keeps the authored bodies honest against the criteria list.
describe('sourceDocuments parity with criteria/citations', () => {
  const withDocs = Object.entries(scenarios).filter(([, s]) => s.sourceDocuments?.length)

  it('covers at least the Ozempic appeal case', () => {
    expect(withDocs.length).toBeGreaterThan(0)
  })

  for (const [id, scenario] of withDocs) {
    const docs = scenario.sourceDocuments!

    it(`${id}: every cited block maps to an existing criterion`, () => {
      const labels = new Set(scenario.criteriaResults.map(cr => cr.rule.label))
      for (const doc of docs) {
        for (const block of doc.blocks) {
          if (block.criterionLabel) {
            expect(labels, `block in ${doc.id} cites unknown criterion`).toContain(block.criterionLabel)
          }
        }
      }
    })

    it(`${id}: every criterion with a citation resolves to a cited block`, () => {
      for (const cr of scenario.criteriaResults) {
        if (scenario.citations[cr.rule.label]) {
          expect(findCitedBlock(docs, cr.rule.label), `criterion "${cr.rule.label}" has no lit span`).not.toBeNull()
        }
      }
    })

    it(`${id}: each cited block text equals its citation snippet (verbatim grounding)`, () => {
      for (const cr of scenario.criteriaResults) {
        const cite = scenario.citations[cr.rule.label]
        if (!cite) continue
        const hit = findCitedBlock(docs, cr.rule.label)!
        const block = docs.find(d => d.id === hit.docId)!.blocks[hit.blockIndex]
        expect(block.text).toBe(cite.text)
      }
    })
  }
})
