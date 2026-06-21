import { describe, it, expect } from 'vitest'
import { buildPasPayload } from './payload'
import { scenarios } from '../../data/scenarios'

describe('buildPasPayload', () => {
  const { fhir, x12 } = buildPasPayload(scenarios['novo-ozempic-initial'])

  it('emits a valid FHIR Da Vinci PAS bundle', () => {
    const bundle = JSON.parse(fhir)
    expect(bundle.resourceType).toBe('Bundle')
    const types = bundle.entry.map((e: { resource: { resourceType: string } }) => e.resource.resourceType)
    expect(types).toContain('Claim')
    expect(types).toContain('QuestionnaireResponse')
  })

  it('extracts the ICD-10 code from the diagnosis string into the Claim', () => {
    const bundle = JSON.parse(fhir)
    const claim = bundle.entry.find((e: { resource: { resourceType: string } }) => e.resource.resourceType === 'Claim').resource
    expect(claim.use).toBe('preauthorization')
    expect(claim.diagnosis[0].diagnosisCodeableConcept.coding[0].code).toBe('E11.9')
  })

  it('maps one questionnaire answer per criterion', () => {
    const bundle = JSON.parse(fhir)
    const qr = bundle.entry.find((e: { resource: { resourceType: string } }) => e.resource.resourceType === 'QuestionnaireResponse').resource
    expect(qr.item).toHaveLength(scenarios['novo-ozempic-initial'].criteriaResults.length)
  })

  it('emits X12 278 segments with the dot-stripped ICD code', () => {
    expect(x12).toContain('ST*278')
    expect(x12).toContain('HI*ABK:E119')
  })
})
