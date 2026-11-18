import { type PatientProfileData } from '../components/portfolio/patient'

// ---------------------------------------------------------------------------
// Patient-level demo data for the patient profile modules (Clinical Profile,
// Trial & Adherence Log, PA history). Frontend demo data only — no backend, no
// real PHI, keyed by patientRef. Modules fall back to derived/empty states for
// patients without an authored profile here.
//
// Margaret Vance (PT-3102) is authored richly as the multi-PA showcase: her
// active Ozempic appeal plus a prior approved Ozempic PA and an approved CGM
// *device* PA — clinically coherent for a T2DM patient, and demonstrating that
// one patient carries several PAs across medication and device targets. History
// entries are summary/audit-level only (drug, date, decision) — no invented
// clinical criteria.
// ---------------------------------------------------------------------------

export const patientProfiles: Record<string, PatientProfileData> = {
  'PT-3102': {
    clinical: {
      summary:
        'Type 2 Diabetes Mellitus on oral therapy with inadequate glycemic control; GLP-1 agonist initiated for glycemic management. Hypertension and hyperlipidemia stable on therapy.',
      diagnoses: [
        { code: 'E11.9', label: 'Type 2 Diabetes Mellitus, without complications', since: '2021' },
        { code: 'I10',   label: 'Essential (primary) hypertension', since: '2018' },
        { code: 'E78.5', label: 'Hyperlipidemia, unspecified', since: '2019' },
      ],
      medications: [
        { name: 'Metformin', sig: '1000 mg PO BID' },
        { name: 'Lisinopril', sig: '10 mg PO daily' },
        { name: 'Atorvastatin', sig: '40 mg PO nightly' },
        { name: 'Ozempic (semaglutide)', sig: '0.5 mg SC weekly — pending PA' },
      ],
      allergies: ['NKDA (no known drug allergies)'],
    },
    compliance: { pdc: '94.8%', durationDays: 90 },
    trials: [
      { date: '2026-01-15', therapy: 'Metformin 1000 mg', facility: 'Walgreens #4412', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-9948', verified: true },
      { date: '2025-12-14', therapy: 'Metformin 1000 mg', facility: 'Walgreens #4412', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-9912', verified: true },
      { date: '2025-11-15', therapy: 'Metformin 1000 mg', facility: 'Walgreens #4412', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-9877', verified: true },
    ],
    paHistory: [
      { drug: 'Continuous Glucose Monitor (Dexcom G7)', targetType: 'device', filedDate: 'Feb 12, 2026', decision: 'approved', determinationId: 'AUTH-6620145' },
      { drug: 'Ozempic (semaglutide) — initial', targetType: 'medication', filedDate: 'Jan 3, 2026', decision: 'approved', determinationId: 'AUTH-6410882' },
    ],
  },
}
