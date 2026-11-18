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
  'PT-3101': {
    clinical: {
      summary:
        'Type 2 Diabetes Mellitus (E11.9) established 2021 with elevated fasting glucose (187 mg/dL) on metformin. Recent clinic note mentions BMI 33.2 kg/m² and weight goals, triggering a pre-submission T2DM-only attestation check.',
      diagnoses: [
        { code: 'E11.9', label: 'Type 2 Diabetes Mellitus, without complications', since: '2021' },
        { code: 'I10',   label: 'Essential (primary) hypertension', since: '2019' },
        { code: 'E78.5', label: 'Hyperlipidemia, unspecified', since: '2020' },
      ],
      medications: [
        { name: 'Metformin', sig: '1000 mg PO BID' },
        { name: 'Lisinopril', sig: '10 mg PO daily' },
        { name: 'Atorvastatin', sig: '40 mg PO nightly' },
        { name: 'Ozempic (semaglutide)', sig: '0.5 mg SC weekly — awaiting attestation' },
      ],
      allergies: ['NKDA (no known drug allergies)'],
    },
    compliance: { pdc: '91.4%', durationDays: 90 },
    trials: [
      { date: '2026-05-01', therapy: 'Metformin 1000 mg', facility: 'CVS Pharmacy #1184', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-8410', verified: true },
      { date: '2026-04-01', therapy: 'Metformin 1000 mg', facility: 'CVS Pharmacy #1184', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-8362', verified: true },
      { date: '2026-03-02', therapy: 'Metformin 1000 mg', facility: 'CVS Pharmacy #1184', quantity: '60 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-8311', verified: true },
    ],
    paHistory: [],
  },
  'PT-3098': {
    clinical: {
      summary:
        'Type 2 Diabetes Mellitus (E11.9) diagnosed 2022 with rising HbA1c (8.1% → 8.6% over 12 months) despite dual oral therapy. Prescriber attestation confirms T2DM glycemic control indication; all Cigna cnf_360 criteria satisfied.',
      diagnoses: [
        { code: 'E11.9', label: 'Type 2 Diabetes Mellitus, without complications', since: '2022' },
      ],
      medications: [
        { name: 'Metformin', sig: '500 mg PO BID' },
        { name: 'Empagliflozin (Jardiance)', sig: '10 mg PO daily' },
        { name: 'Ozempic (semaglutide)', sig: '0.5 mg SC weekly — pending PA' },
      ],
      allergies: ['NKDA (no known drug allergies)'],
    },
    compliance: { pdc: '96.2%', durationDays: 180 },
    trials: [
      { date: '2026-05-18', therapy: 'Metformin 500 mg + Empagliflozin 10 mg', facility: 'Walgreens #2091', quantity: '90d fill', supply: '90d', fhirRef: 'FHIR-CLAIM-9104', verified: true },
      { date: '2026-02-17', therapy: 'Metformin 500 mg + Empagliflozin 10 mg', facility: 'Walgreens #2091', quantity: '90d fill', supply: '90d', fhirRef: 'FHIR-CLAIM-8990', verified: true },
    ],
    paHistory: [],
  },
  'PT-4201': {
    clinical: {
      summary:
        'Pediatric GERD with LA Grade B erosive esophagitis (K21.0) confirmed on 05/12/2026 endoscopy and oral-motor dysphagia with aspiration risk on solid oral tablets/capsules (SLP 05/02/2026). UHC approved 10 mg/day counter-offer; 20 mg/day indicated for ≥20 kg.',
      diagnoses: [
        { code: 'K21.0',  label: 'Gastroesophageal reflux disease with esophagitis (LA Grade B)', since: '2026' },
        { code: 'R13.10', label: 'Oral-motor dysphagia (swallowing limitation)', since: '2026' },
      ],
      medications: [
        { name: 'Nexium (esomeprazole) Oral Suspension', sig: '20 mg PO daily — appeal round 2' },
        { name: 'Omeprazole Tablet', sig: 'Discontinued after 6 days (choking / aspiration)' },
      ],
      allergies: ['Intolerance: solid oral tablets/capsules (aspiration risk)'],
    },
    compliance: { pdc: '100%', durationDays: 70 },
    trials: [
      { date: '2026-04-12', therapy: 'Omeprazole 10 mg tablet (aborted 6d — choking)', facility: 'Rite Aid #0441', quantity: '30 Tabs', supply: '6d used', fhirRef: 'FHIR-CLAIM-7721', verified: true },
      { date: '2026-03-10', therapy: 'Dietary & positioning conservative therapy (10w)', facility: 'Meridian Pediatric GI', quantity: 'Clinical plan', supply: '70d', fhirRef: 'FHIR-EHR-4201', verified: true },
    ],
    paHistory: [
      { drug: 'Nexium 10mg Oral Suspension (Partial Counter-Offer)', targetType: 'medication', filedDate: 'Jun 9, 2026', decision: 'approved', determinationId: 'AUTH-5592014' },
    ],
  },
  'PT-2847': {
    clinical: {
      summary:
        'Primary Biliary Cholangitis (K74.3) with AMA-M2 titer 1:640, stage II–III fibrosis on biopsy, and persistently elevated ALP (312 U/L; ULN 187 U/L) after 14 months of ursodiol. Pending reconciliation of conflicting hepatic decompensation notes and specialist confirmation.',
      diagnoses: [
        { code: 'K74.3', label: 'Primary Biliary Cholangitis (PBC)', since: '2024' },
        { code: 'K74.6', label: 'Cirrhosis — compensated vs. decompensation conflict under review', since: '2026' },
      ],
      medications: [
        { name: 'Ursodiol (UDCA)', sig: '13–15 mg/kg/day PO (14 months — inadequate response)' },
        { name: 'Livdelzi (seladelpar)', sig: '10 mg PO daily — PA exception review' },
      ],
      allergies: ['NKDA (no known drug allergies)'],
    },
    compliance: { pdc: '93.5%', durationDays: 420 },
    trials: [
      { date: '2026-05-15', therapy: 'Ursodiol 300 mg (13 mg/kg/day)', facility: 'Optum Specialty Pharmacy', quantity: '90 Caps', supply: '30d', fhirRef: 'FHIR-CLAIM-6104', verified: true },
      { date: '2026-04-14', therapy: 'Ursodiol 300 mg (13 mg/kg/day)', facility: 'Optum Specialty Pharmacy', quantity: '90 Caps', supply: '30d', fhirRef: 'FHIR-CLAIM-6049', verified: true },
      { date: '2025-04-10', therapy: 'Ursodiol 300 mg initiation', facility: 'Optum Specialty Pharmacy', quantity: '90 Caps', supply: '30d', fhirRef: 'FHIR-CLAIM-5102', verified: true },
    ],
    paHistory: [],
  },
  'PT-5177': {
    clinical: {
      summary:
        'Moderately-to-severely active seropositive Rheumatoid Arthritis (M05.79; RF 78 IU/mL, anti-CCP >250 U/mL, CDAI 28). Stabilized ≥6 months on brand Humira prior to plan-mandated biosimilar switch (adalimumab-adbm), which caused loss of response and injection-site reactions.',
      diagnoses: [
        { code: 'M05.79', label: 'Seropositive Rheumatoid Arthritis, multiple sites', since: '2021' },
      ],
      medications: [
        { name: 'Methotrexate', sig: '20 mg PO/SC weekly (continued in combination)' },
        { name: 'Humira (adalimumab)', sig: '40 mg SC q14d — PSM013 preferred-product exception' },
        { name: 'Adalimumab-adbm (Cyltezo)', sig: 'Discontinued 06/2025 (loss of response + injection reaction)' },
      ],
      allergies: ['Adalimumab-adbm (Cyltezo) — injection-site reactions & loss of efficacy'],
    },
    compliance: { pdc: '95.0%', durationDays: 330 },
    trials: [
      { date: '2025-06-15', therapy: 'Adalimumab-adbm (Cyltezo) 40 mg', facility: 'Accredo Specialty', quantity: '2 Pens', supply: '28d', fhirRef: 'FHIR-CLAIM-7088', verified: true },
      { date: '2025-01-10', therapy: 'Methotrexate 20 mg weekly (11mo trial)', facility: 'Walgreens #8812', quantity: '24 Tabs', supply: '30d', fhirRef: 'FHIR-CLAIM-6941', verified: true },
    ],
    paHistory: [
      { drug: 'Humira (adalimumab) — prior stabilization', targetType: 'medication', filedDate: 'Nov 4, 2024', decision: 'approved', determinationId: 'AUTH-4920118' },
    ],
  },
}
