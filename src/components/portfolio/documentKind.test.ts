import { describe, it, expect } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { classifyDocumentKind, documentKindMeta } from './documentKind'

// The classifier decides how a citation's evidence renders as a document
// excerpt (letterhead / page chrome). Sources come verbatim from the golden
// scenario citations — never invented here (CLAUDE.md DRY rule); this test
// pins the mapping for the strings those fixtures actually use.

describe('classifyDocumentKind', () => {
  it('routes consults, notes, summaries, and evaluations to clinical_note', () => {
    expect(classifyDocumentKind('Specialist Consult (Endocrinology)')).toBe('clinical_note')
    expect(classifyDocumentKind('Hepatology Consult, p.1 (05/28/2026)')).toBe('clinical_note')
    expect(classifyDocumentKind('Pediatric GI Consult')).toBe('clinical_note')
    expect(classifyDocumentKind('Office Visit Notes')).toBe('clinical_note')
    expect(classifyDocumentKind('Outpatient Visit Notes')).toBe('clinical_note')
    expect(classifyDocumentKind('Discharge Summary, p.2 (06/02/2026)')).toBe('clinical_note')
    expect(classifyDocumentKind('Speech-Language Pathology Evaluation')).toBe('clinical_note')
  })

  it('routes lab reports and medication lists to their own kinds', () => {
    expect(classifyDocumentKind('Lab Report')).toBe('lab_report')
    expect(classifyDocumentKind('Medication List')).toBe('medication_list')
  })

  it('routes structured EHR feeds to ehr_record', () => {
    expect(classifyDocumentKind('Epic · FHIR')).toBe('ehr_record')
  })

  it('routes denial/policy/determination language to payer_letter', () => {
    expect(classifyDocumentKind('Cigna Denial Letter')).toBe('payer_letter')
    expect(classifyDocumentKind('Coverage Policy 0422-RA')).toBe('payer_letter')
    expect(classifyDocumentKind('Coverage Determination')).toBe('payer_letter')
  })

  it('treats Conflict / Missing markers as unavailable, not a real document', () => {
    expect(classifyDocumentKind('Conflict')).toBe('unavailable')
    expect(classifyDocumentKind('Missing')).toBe('unavailable')
  })

  it('falls back to generic for an unrecognized source', () => {
    expect(classifyDocumentKind('Some Uncatalogued Attachment')).toBe('generic')
  })

  it('is case-insensitive', () => {
    expect(classifyDocumentKind('MEDICATION LIST')).toBe('medication_list')
    expect(classifyDocumentKind('lab report')).toBe('lab_report')
  })
})

describe('documentKindMeta', () => {
  it('returns a human label alongside the kind', () => {
    expect(documentKindMeta('Medication List')).toEqual({ kind: 'medication_list', label: 'Medication List' })
    expect(documentKindMeta('Specialist Consult (Endocrinology)')).toEqual({
      kind: 'clinical_note',
      label: 'Clinical Note',
    })
  })
})

describe('every golden-set citation source classifies without hitting generic', () => {
  // Guards against a new fixture source silently rendering as a bare document.
  it('classifies all real citation sources to a concrete kind', () => {
    const sources = new Set<string>()
    for (const client of initialClients) {
      const scenario = scenarios[client.scenarioId]
      if (!scenario) continue
      for (const cite of Object.values(scenario.citations)) sources.add(cite.source)
    }
    expect(sources.size).toBeGreaterThan(0)
    for (const source of sources) {
      const kind = classifyDocumentKind(source)
      // 'Conflict'/'Missing' are legitimately unavailable; everything else must
      // resolve to a real document kind rather than the generic fallback.
      if (kind === 'unavailable') continue
      expect(kind, `source "${source}" fell through to generic`).not.toBe('generic')
    }
  })
})
