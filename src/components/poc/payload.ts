import type { ScenarioConfig } from '../../types'

// The machine payload behind a structured PA request. The human-readable request
// (PaRequestReviewPanel) is the companion to this — what the coordinator reads;
// this is what the payer's UM system actually receives over the wire. Da Vinci
// PAS transmits a FHIR bundle (Claim use=preauthorization + the DTR
// QuestionnaireResponse); the legacy EDI equivalent is an X12 278 review request.
// Representative/illustrative — grounded in the scenario, not a validated bundle.

const icd10 = (diagnosis: string) => diagnosis.match(/\(([^)]+)\)/)?.[1] ?? '—'

export function buildPasPayload(scenario: ScenarioConfig): { fhir: string; x12: string } {
  const code = icd10(scenario.diagnosis)

  const fhir = JSON.stringify({
    resourceType: 'Bundle',
    type: 'collection',
    meta: { profile: ['http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-pas-request-bundle'] },
    entry: [
      {
        resource: {
          resourceType: 'Claim',
          use: 'preauthorization',
          status: 'active',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'pharmacy' }] },
          patient: { reference: 'Patient/example' },
          insurance: [{ sequence: 1, focal: true, coverage: { display: `${scenario.plan} (${scenario.planId})` } }],
          diagnosis: [{ sequence: 1, diagnosisCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code }] } }],
          item: [{ sequence: 1, productOrService: { text: scenario.requestedTherapy ?? scenario.drug } }],
        },
      },
      {
        resource: {
          resourceType: 'QuestionnaireResponse',
          status: 'completed',
          questionnaire: `Questionnaire/${scenario.configFile.replace('.json', '')}`,
          item: scenario.criteriaResults.map((cr, i) => {
            const cite = scenario.citations[cr.rule.label]
            return {
              linkId: `q${i + 1}`,
              text: cr.rule.label,
              answer: [{ valueString: `Met — ${cite ? `${cite.source}, ${cite.page}` : 'supported in record'}` }],
            }
          }),
        },
      },
    ],
  }, null, 2)

  const carrier = scenario.plan.split(' ')[0].toUpperCase()
  const x12 = [
    `ISA*00*          *00*          *ZZ*CLEARAUTH      *ZZ*${carrier.padEnd(15).slice(0, 15)}*260617*1200*^*00501*000000001*0*P*:~`,
    `GS*HI*CLEARAUTH*${carrier}*20260617*1200*1*X*005010X217~`,
    `ST*278*0001*005010X217~`,
    `BHT*0078*13*CLEAR-${scenario.planId}*20260617*1200~`,
    `HL*1**20*1~`,
    `NM1*X3*2*${scenario.plan}*****PI*${scenario.planId}~`,
    `HL*2*1*21*1~`,
    `NM1*1P*2*MERIDIAN HEALTH SYSTEM*****XX*1538293726~`,
    `HL*3*2*22*0~`,
    `NM1*IL*1*DOE*JANE****MI*W123456789~`,
    `UM*HS*I*3*****Y~`,
    `DTP*472*D8*20260617~`,
    `HI*ABK:${code.replace('.', '')}~`,
    `SE*13*0001~`,
  ].join('\n')

  return { fhir, x12 }
}
