import { type CaseTier, type CaseStatus, type Client, type CriterionResult, type ScenarioConfig, type UniversalPrimitive } from '../types'

export const universalPrimitives: UniversalPrimitive[] = [
  {
    type: 'diagnostic',
    schemaClass: 'DiagnosticRule',
    name: 'Diagnostic Rule',
    description: 'Confirms the presence or absence of a clinical diagnosis. The retrieval agent scans ICD codes, specialist consult notes, and attending physician documentation.',
    params: ['condition_category: str', 'must_be_present: bool'],
  },
  {
    type: 'math',
    schemaClass: 'BiomarkerRule',
    name: 'Biomarker / Math Rule',
    description: 'Compares an extracted lab value against a threshold. Supports absolute values, multiples of the upper limit of normal (ULN), and recency windows on lab dates.',
    params: ['biomarker_name: str', 'operator: Literal[">=","<=","==",">","<"]', 'absolute_threshold: float | None', 'multiplier_of_uln: float | None', 'max_age_days: int'],
  },
  {
    type: 'temporal',
    schemaClass: 'TemporalRule',
    name: 'Temporal Rule',
    description: 'Verifies that a prior line of therapy was administered for a minimum duration. Supports clinical intolerance as a documented bypass condition.',
    params: ['intervention_target: str', 'minimum_duration_days: int', 'allows_intolerance_bypass: bool'],
  },
  {
    type: 'safety',
    schemaClass: 'DiagnosticRule (must_be_present=False)',
    name: 'Safety / Contraindication Rule',
    description: 'A hard exclusion gate. If the contraindicated condition is documented in the chart, the pipeline halts and returns Denied — regardless of other criteria.',
    params: ['condition_category: str', 'must_be_present: False  # always False for safety gates'],
  },
  {
    type: 'provider',
    schemaClass: 'ProviderRule',
    name: 'Provider / Specialist Rule',
    description: 'Confirms that the requesting or co-signing provider meets the payer\'s specialty and credentialing requirements. The retrieval agent checks NPI records, board certifications, and the ordering provider field on the PA form.',
    params: ['required_specialty: str', 'must_be_ordering_provider: bool', 'accepts_cosignature: bool'],
  },
  {
    type: 'quantity',
    schemaClass: 'QuantityRule',
    name: 'Dose / Quantity Rule',
    description: 'Verifies that the requested dose or dispensed quantity falls within payer-approved bounds. Supports weight-based and age-based dose calculations. Distinct from BiomarkerRule — this checks the requested treatment, not a lab measurement.',
    params: ['dose_unit: Literal["mcg","mg","mg/kg","mg/kg/day","mL","L","units"]', 'min_dose: float | None', 'max_dose: float | None', 'weight_based: bool', 'max_supply_days: int | None'],
  },
]

// ---------------------------------------------------------------------------
// Layer 2 — Drug × Carrier Configurations
// ---------------------------------------------------------------------------

// Single source of truth for the Ozempic × Cigna policy pack — shared by the
// initial-PA case and the appeal case, since both resolve the SAME registry pack
// (ozempic_cigna_base). Reinforces the platform "one pack, reused across the
// lifecycle" story.
const ozempicCignaConfigJson = `{
  "policy_id": "ozempic-cigna-base-v1",
  "target_drug": "semaglutide",
  "carrier": "cigna",
  "diagnostic_rules": [
    { "condition_category": "Type 2 Diabetes Mellitus", "must_be_present": true }
  ],
  "biomarker_rules": [
    { "biomarker_name": "HbA1c", "operator": ">=",
      "absolute_threshold": 7.5, "max_age_days": 180 }
  ],
  "temporal_rules": [
    { "intervention_target": "Metformin",
      "minimum_duration_days": 90, "allows_intolerance_bypass": true }
  ],
  "safety_rules": [
    { "condition_category": "Medullary Thyroid Carcinoma (MTC) or MEN2",
      "must_be_present": false }
  ]
}`

// One patient's evidence, shared across the PH-3101 (denied initial PA) → PH-3102
// (appeal) journey. The initial PA is filed with all four criteria satisfied;
// Cigna denies it on a step-therapy technicality; the appeal asserts the very same
// documented evidence. Single source of truth so both stages can't drift apart.
const ozempicCriteria: CriterionResult[] = [
  {
    rule: { type: 'diagnostic', label: 'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)' },
    status: 'found',
    note: 'Page 1 — Endocrinology consult confirms T2DM with HbA1c trend documented over 18 months.',
    docSource: 'Specialist Consult (Endocrinology)',
  },
  {
    rule: { type: 'math', label: 'HbA1c >= 7.5% on Current Oral Regimen' },
    status: 'found',
    note: 'Page 4 — HbA1c 8.2% (03/14/2024). Threshold ≥7.5%. Criterion satisfied.',
    docSource: 'Lab Report',
  },
  {
    rule: { type: 'temporal', label: 'Metformin Therapy >= 90 Consecutive Days at Maximum Tolerated Dose' },
    status: 'found',
    note: 'Page 3 — Pharmacy refill record confirms Metformin 1000mg BID for 112 consecutive days prior to referral. 90-day threshold satisfied.',
    docSource: 'Pharmacy Records',
  },
  {
    rule: { type: 'safety', label: 'NO Personal or Family History of Medullary Thyroid Carcinoma (MTC)' },
    status: 'found',
    note: 'Page 2 — Oncology history review negative for MTC. No family history of MEN2 syndrome documented.',
    docSource: 'Medical History',
  },
]

const ozempicCitations: ScenarioConfig['citations'] = {
  'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)':
    { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Endocrinology consult 02/08/2024 — T2DM established 2021. HbA1c trend: 7.9% → 8.2% over 18 months.' },
  'HbA1c >= 7.5% on Current Oral Regimen':
    { source: 'Lab Report', page: 'p. 4', text: 'Lab report 03/14/2024 — HbA1c: 8.2% (threshold ≥7.5%). Result confirmed.' },
  'Metformin Therapy >= 90 Consecutive Days at Maximum Tolerated Dose':
    { source: 'Pharmacy Records', page: 'p. 3', text: 'Pharmacy refill record confirms Metformin 1000mg BID — 112 consecutive days prior to referral.' },
  'NO Personal or Family History of Medullary Thyroid Carcinoma (MTC)':
    { source: 'Medical History', page: 'p. 2', text: 'Oncology history — No personal or family history of MTC or MEN2 syndrome. Thyroid ultrasound negative.' },
}

export const scenarios: Record<string, ScenarioConfig> = {
  // ── Ozempic family: Cigna base ──────────────────────────────────────────────
  'novo-ozempic': {
    id: 'novo-ozempic',
    drugKey: 'ozempic',
    configFile: 'ozempic_cigna_base.json',
    drug: 'Ozempic (semaglutide)',
    manufacturer: 'Novo Nordisk',
    plan: 'Cigna Connect 500 PPO',
    planId: 'CIGNA-C500-2024',
    categoryKey: 'endocrinology',
    categoryLabel: 'Endocrinology',
    diagnosis: 'Type 2 Diabetes Mellitus (E11.9)',
    denialReason: 'Step therapy requirements not met — metformin trial documentation insufficient',
    clientType: 'patient',
    criteriaResults: ozempicCriteria,
    citations: ozempicCitations,
    configJson: ozempicCignaConfigJson,
    timeline: [
      { label: 'PA Filed',      date: 'Jun 5, 2026',  status: 'done'    as const, note: 'Cigna step therapy'    },
      { label: 'Denial',        date: 'Jun 8, 2026',  status: 'done'    as const, note: 'Step therapy not met'  },
      { label: 'Coord. Review', date: 'Pending',       status: 'pending' as const, note: 'Appeal letter drafted' },
    ],
  },

  // ── Ozempic family: Cigna initial PA — front-of-lifecycle happy path ─────────
  // Same pack as novo-ozempic (the appeal), DIFFERENT patient. This is a NEW PA
  // request assembled from a complete chart and filed via Da Vinci PAS — the
  // high-volume routine base. Approved on first pass (fast time-to-therapy).
  'novo-ozempic-initial': {
    id: 'novo-ozempic-initial',
    drugKey: 'ozempic',
    configFile: 'ozempic_cigna_base.json',
    drug: 'Ozempic (semaglutide)',
    manufacturer: 'Novo Nordisk',
    plan: 'Cigna Connect 500 PPO',
    planId: 'CIGNA-C500-2024',
    categoryKey: 'endocrinology',
    categoryLabel: 'Endocrinology',
    diagnosis: 'Type 2 Diabetes Mellitus (E11.9)',
    denialReason: 'Initial prior authorization — no prior denial',
    clientType: 'patient',
    lifecycle: 'initial_pa',
    paRequired: {
      required: true,
      basis: "CRD pre-check: Cigna requires prior authorization for GLP-1 agonists under CIGNA-C500-2024 (formulary step-therapy tier). PA required for semaglutide — proceed to assemble the request.",
    },
    requestedTherapy: 'Ozempic (semaglutide) 0.5 mg subcutaneous once weekly — 90-day supply, 3 refills',
    criteriaResults: [
      {
        rule: { type: 'diagnostic', label: 'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)' },
        status: 'found',
        note: 'Page 1 — Endocrinology consult 06/12/2026 confirms T2DM (E11.9), established 2022.',
        docSource: 'Specialist Consult (Endocrinology)',
      },
      {
        rule: { type: 'math', label: 'HbA1c >= 7.5% on Current Oral Regimen' },
        status: 'found',
        note: 'Page 4 — HbA1c 8.6% (06/02/2026). Threshold ≥7.5%. Criterion satisfied.',
        docSource: 'Lab Report',
      },
      {
        rule: { type: 'temporal', label: 'Metformin Therapy >= 90 Consecutive Days at Maximum Tolerated Dose' },
        status: 'found',
        note: 'Page 3 — Pharmacy refill record confirms Metformin 1000mg BID for 134 consecutive days. 90-day threshold satisfied.',
        docSource: 'Pharmacy Records',
      },
      {
        rule: { type: 'safety', label: 'NO Personal or Family History of Medullary Thyroid Carcinoma (MTC)' },
        status: 'found',
        note: 'Page 2 — Oncology history review negative for MTC. No family history of MEN2 syndrome documented.',
        docSource: 'Medical History',
      },
    ],
    citations: {
      'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)':
        { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Endocrinology consult 06/12/2026 — T2DM established 2022. HbA1c trend: 8.1% → 8.6% over 12 months on oral therapy.' },
      'HbA1c >= 7.5% on Current Oral Regimen':
        { source: 'Lab Report', page: 'p. 4', text: 'Lab report 06/02/2026 — HbA1c: 8.6% (threshold ≥7.5%). Result confirmed.' },
      'Metformin Therapy >= 90 Consecutive Days at Maximum Tolerated Dose':
        { source: 'Pharmacy Records', page: 'p. 3', text: 'Pharmacy refill record confirms Metformin 1000mg BID — 134 consecutive days prior to this order.' },
      'NO Personal or Family History of Medullary Thyroid Carcinoma (MTC)':
        { source: 'Medical History', page: 'p. 2', text: 'Oncology history — No personal or family history of MTC or MEN2 syndrome. Thyroid ultrasound negative.' },
    },
    configJson: ozempicCignaConfigJson,
    paOutcome: {
      decision: 'approved',
      determinationId: 'AUTH-7741299',
      timeToTherapy: '2 days',
      note: 'Cigna approved the request as filed via Da Vinci PAS. Authorization valid 12 months. Patient can begin therapy without delay.',
    },
    timeline: [
      { label: 'Order Received', date: 'Jun 16, 2026', status: 'done'    as const, note: 'Rx from Epic'         },
      { label: 'PA Required',    date: 'Jun 16, 2026', status: 'done'    as const, note: 'CRD: PA needed'       },
      { label: 'Request Assembled', date: 'Jun 17, 2026', status: 'done' as const, note: 'DTR + PAS bundle'     },
      { label: 'Coord. Review',  date: 'Pending',        status: 'pending' as const, note: 'Ready to file'      },
    ],
  },

  // ── Ozempic family: Cigna initial PA — denied → appeal loop (A-T2) ───────────
  // The PH-3102 patient's EARLIER stage. The PA is assembled with all four criteria
  // satisfied and filed via PAS; Cigna denies it on a step-therapy technicality.
  // The denied determination offers "Start appeal", which hands off to the existing
  // novo-ozempic appeal (PH-3102) on the same patient's evidence — closing the loop.
  'novo-ozempic-denied': {
    id: 'novo-ozempic-denied',
    drugKey: 'ozempic',
    configFile: 'ozempic_cigna_base.json',
    drug: 'Ozempic (semaglutide)',
    manufacturer: 'Novo Nordisk',
    plan: 'Cigna Connect 500 PPO',
    planId: 'CIGNA-C500-2024',
    categoryKey: 'endocrinology',
    categoryLabel: 'Endocrinology',
    diagnosis: 'Type 2 Diabetes Mellitus (E11.9)',
    denialReason: 'Step therapy requirements not met — metformin trial documentation insufficient',
    clientType: 'patient',
    lifecycle: 'initial_pa',
    paRequired: {
      required: true,
      basis: "CRD pre-check: Cigna requires prior authorization for GLP-1 agonists under CIGNA-C500-2024 (formulary step-therapy tier). PA required for semaglutide — proceed to assemble the request.",
    },
    requestedTherapy: 'Ozempic (semaglutide) 0.5 mg subcutaneous once weekly — 90-day supply, 3 refills',
    criteriaResults: ozempicCriteria,
    citations: ozempicCitations,
    configJson: ozempicCignaConfigJson,
    paOutcome: {
      decision: 'denied',
      determinationId: 'DENY-CIGNA-5582',
      timeToTherapy: '—',
      note: "Cigna denied the request, asserting the metformin step-therapy trial was insufficiently documented — despite 112 consecutive days of pharmacy fills already on file. This is a contestable denial on documentation grounds, not a clinical one: the evidence supports an appeal.",
    },
    appealHandoff: { scenarioId: 'novo-ozempic', caseRef: 'PH-3102' },
    timeline: [
      { label: 'Order Received', date: 'Jun 3, 2026', status: 'done'    as const, note: 'Rx from Epic'          },
      { label: 'PA Required',    date: 'Jun 3, 2026', status: 'done'    as const, note: 'CRD: PA needed'        },
      { label: 'Request Filed',  date: 'Jun 5, 2026', status: 'done'    as const, note: 'PAS submission'        },
      { label: 'Denial',         date: 'Jun 8, 2026', status: 'flagged' as const, note: 'Step therapy disputed' },
    ],
  },

  // ── Livdelzi: PBC — exception case, decompensation conflict + specialist not confirmed ──
  'gilead-livdelzi': {
    id: 'gilead-livdelzi',
    drugKey: 'livdelzi',
    configFile: 'livdelzi_cigna_hepatology.json',
    drug: 'Livdelzi (seladelpar)',
    manufacturer: 'Gilead Sciences',
    plan: 'Cigna Healthcare PPO',
    planId: 'CIGNA-COM-2025',
    categoryKey: 'hepatology',
    categoryLabel: 'Hepatology',
    diagnosis: 'Primary Biliary Cholangitis (PBC) — K75.89',
    denialReason: 'Prior authorization criteria not met — decompensation history conflict unresolved and specialist prescriber not confirmed',
    clientType: 'patient',
    criteriaResults: [
      {
        rule: { type: 'diagnostic', label: 'Confirmed PBC Diagnosis (≥2 of 3 AASLD criteria)' },
        status: 'found',
        note: 'Page 1 — Hepatology consult 05/28/2026 confirms PBC. AMA-M2 titer: 1:640. Liver biopsy 04/15/2026: stage II–III fibrosis consistent with PBC. Meets 2 of 3 criteria: positive AMA + histologic evidence.',
        docSource: 'Hepatology Consult',
      },
      {
        rule: { type: 'temporal', label: 'Inadequate Response to Ursodiol ≥12 Months' },
        status: 'found',
        note: 'Page 3 — Ursodiol 13–15 mg/kg/day documented from Apr 2025. Duration: 14 months. Prescriber attestation of inadequate response on file. ALP 312 U/L (ULN 187 U/L) at Jun 5, 2026.',
        docSource: 'Lab Report',
      },
      {
        rule: { type: 'safety', label: 'No Current or Prior Hepatic Decompensation Event' },
        status: 'conflict',
        note: 'Two source documents disagree on decompensation. The system will not silently pick one — a contradiction on this absolute safety exclusion is escalated to a clinician to reconcile before the case can proceed.',
        docSource: 'Hepatology Consult p.1 ⚠ vs Discharge Summary p.2',
        suggestedAction: 'Route to the treating hepatologist to reconcile the conflicting decompensation findings. New-onset ascites in the discharge summary, if confirmed, is an absolute contraindication to Livdelzi.',
        workflowPlan: {
          action: 'Reconcile conflicting decompensation findings between consult and discharge summary',
          recipient: 'Treating hepatologist',
          channel: 'EHR secure message',
          turnaround: '24–48 hours',
        },
        conflictSources: [
          { source: 'Hepatology Consult, p.1 (05/28/2026)', claim: 'No clinical or biochemical evidence of hepatic decompensation.' },
          { source: 'Discharge Summary, p.2 (06/02/2026)', claim: 'Admitted for new-onset ascites — first decompensation event.' },
        ],
      },
      {
        rule: { type: 'diagnostic', label: 'Specialist Prescriber (Gastroenterologist / Hepatologist / Transplant Physician)' },
        status: 'needs_review',
        note: 'Prescribing physician specialty not confirmed in records provided. Cigna requires Livdelzi to be prescribed by or in consultation with a gastroenterologist, hepatologist, or liver transplant physician.',
        docSource: 'Missing',
        suggestedAction: 'Confirm prescriber specialty. If prescribing physician is not a GI/hepatology/transplant specialist, obtain a co-sign or consultation note from one.',
        workflowPlan: {
          action: 'Verify prescriber specialty and obtain consultation note if needed',
          recipient: 'Prescribing physician office',
          channel: 'Phone / fax',
          turnaround: '24 hours',
        },
      },
    ],
    citations: {
      'Confirmed PBC Diagnosis (≥2 of 3 AASLD criteria)':
        { source: 'Hepatology Consult', page: 'p. 1', text: 'AMA-M2 titer 1:640. Liver biopsy 04/15/2026: portal inflammation, bile duct damage, stage II–III fibrosis. Diagnosis: Primary Biliary Cholangitis.' },
      'Inadequate Response to Ursodiol ≥12 Months':
        { source: 'Lab Report', page: 'p. 3', text: 'ALP 312 U/L (ULN 187 U/L). Ursodiol therapy initiated April 2025 at 13 mg/kg/day. Duration: 14 months. Prescriber attests inadequate response.' },
      'No Current or Prior Hepatic Decompensation Event':
        { source: 'Conflict', page: '—', text: 'Hepatology Consult (05/28): no decompensation. Discharge Summary (06/02): admitted for new-onset ascites.' },
      'Specialist Prescriber (Gastroenterologist / Hepatologist / Transplant Physician)':
        { source: 'Missing', page: '—', text: 'Prescriber specialty not documented in records provided.' },
    },
    configJson: `{
  "policy_id": "livdelzi-cigna-hepatology-v1",
  "target_drug": "seladelpar",
  "carrier": "cigna",
  "diagnostic_rules": [
    { "condition_category": "Primary Biliary Cholangitis", "icd10": "K75.89",
      "requires_2_of": ["elevated_alp", "ama_or_pbc_ana", "liver_biopsy"],
      "specialist_required": ["gastroenterologist", "hepatologist", "liver_transplant_physician"] }
  ],
  "temporal_rules": [
    { "intervention_target": "ursodiol",
      "minimum_duration_days": 365, "allows_intolerance_bypass": true }
  ],
  "biomarker_rules": [
    { "biomarker_name": "ALP", "operator": ">", "comparator": "ULN", "max_age_days": 90 }
  ],
  "safety_rules": [
    { "condition_category": "Hepatic decompensation (ascites, varices, encephalopathy, coagulopathy)",
      "must_be_present": false, "includes_history": true }
  ]
}`,
    timeline: [
      { label: 'PA Filed',        date: 'Jun 9, 2026', status: 'done'    as const, note: 'Cigna hepatology'         },
      { label: 'Docs Conflict',   date: 'Jun 9, 2026', status: 'flagged' as const, note: 'Decompensation conflict'  },
      { label: 'Coord. Action',   date: 'Pending',      status: 'pending' as const, note: 'Resolve + verify specialist' },
    ],
  },

  // ── Infant GERD: Omeprazole suspension — multi-round escalation demo ────────
  'infant-omeprazole': {
    id: 'infant-omeprazole',
    drugKey: 'omeprazole',
    configFile: 'omeprazole_uhc_pediatric.json',
    drug: 'Omeprazole (Prilosec) 2mg/mL Oral Suspension',
    manufacturer: 'Fagron Compounding Services',
    plan: 'UnitedHealthcare Choice Plus',
    planId: 'UHC-CHOICE-2024',
    categoryKey: 'gastroenterology',
    categoryLabel: 'Gastroenterology',
    diagnosis: 'Gastroesophageal Reflux Disease with Esophagitis — Infant (K21.0)',
    denialReason: 'Non-formulary compounded formulation — tablet/capsule alternatives required, step therapy not documented',
    clientType: 'patient',
    criteriaResults: [
      {
        rule: { type: 'diagnostic', label: 'Confirmed GERD Diagnosis with Esophageal Involvement (K21.0)' },
        status: 'found',
        note: 'Page 1 — Pediatric GI consult 05/14/2026 confirms erosive GERD. Upper endoscopy (05/12/2026): Los Angeles Grade B esophagitis.',
        docSource: 'Pediatric GI Consult',
      },
      {
        rule: { type: 'safety', label: 'Patient Age ≤12 Months — Solid Oral Dosage Forms Physically Contraindicated' },
        status: 'found',
        note: 'Page 1 — D.O.B. 02/03/2026. Age 4 months. UHC formulary alternatives (omeprazole 20mg capsule, esomeprazole 20mg capsule) require intact swallowing — developmentally impossible at this age.',
        docSource: 'Admission Record',
      },
      {
        rule: { type: 'safety', label: 'Ranitidine (Formulary H2 Alternative) — FDA Market Withdrawal, NDMA Contamination (April 2020)' },
        status: 'found',
        note: 'Ranitidine (Zantac) withdrawn from US market April 1, 2020 per FDA request due to unacceptable NDMA contamination levels. Product unavailable — no trial possible.',
        docSource: 'FDA MedWatch Safety Alert',
      },
      {
        rule: { type: 'temporal', label: 'Non-Pharmacological Conservative Therapy Trial (Positioning, Thickened Feeds ≥2 Weeks)' },
        status: 'found',
        note: 'Page 3 — 6-week visit (04/20/2026) documents positioning protocol and thickened feeds initiated at 4-week visit. 10-week follow-up confirms worsening despite ≥2 weeks of conservative management.',
        docSource: 'Outpatient Visit Notes',
      },
    ],
    citations: {
      'Confirmed GERD Diagnosis with Esophageal Involvement (K21.0)': {
        source: 'Pediatric GI Consult', page: 'p. 1',
        text: 'Endoscopy 05/12/2026 — Los Angeles Grade B esophagitis confirmed. Pediatric GI assessment: erosive GERD requiring PPI therapy. ICD-10 K21.0.',
      },
      'Patient Age ≤12 Months — Solid Oral Dosage Forms Physically Contraindicated': {
        source: 'Admission Record', page: 'p. 1',
        text: 'D.O.B. 02/03/2026. Age at prescription: 4 months. Developmental stage: pre-solid foods. Administration of tablet or capsule formulations is not developmentally possible.',
      },
      'Ranitidine (Formulary H2 Alternative) — FDA Market Withdrawal, NDMA Contamination (April 2020)': {
        source: 'FDA MedWatch Safety Alert', page: 'April 1, 2020',
        text: 'FDA requested immediate market withdrawal of all ranitidine products due to NDMA impurity exceeding acceptable limits. Product is no longer commercially available in the United States.',
      },
      'Non-Pharmacological Conservative Therapy Trial (Positioning, Thickened Feeds ≥2 Weeks)': {
        source: 'Outpatient Visit Notes', page: 'p. 3',
        text: '6-week visit 04/20/2026 — positioning guidance provided. Thickened feeds discussed. 10-week follow-up noted worsening regurgitation and feeding aversion despite measures.',
      },
    },
    payerCounterOffer: {
      date: 'Jun 10, 2026',
      summary: 'Exception to non-formulary status granted for liquid formulation. Authorization approved for Omeprazole 2mg/mL oral suspension — however, approved dose is limited to 0.5 mg/kg/day for 30 days.',
      newDenialReason: 'Dose exceeds standard protocol — authorization limited to 0.5 mg/kg/day',
      approvedDose: '0.5 mg/kg/day (below evidence-based therapeutic threshold)',
    },
    round2Appeal: {
      keyArgument: 'The authorized dose of 0.5 mg/kg/day falls below the minimum evidence-based therapeutic threshold for infantile erosive GERD. NASPGHAN/ESPGHAN 2018 joint clinical practice guidelines (PMID 29470322) recommend 0.7–1.4 mg/kg/day as the effective dosing range for infants with confirmed esophagitis. Approval at 0.5 mg/kg/day is predicted to provide insufficient acid suppression and does not meet the standard of care for this diagnosis.',
      guidelineRef: 'Rosen R, et al. Pediatric Gastroesophageal Reflux Clinical Practice Guidelines: Joint Recommendations of NASPGHAN and ESPGHAN. J Pediatr Gastroenterol Nutr. 2018;66(3):516–554.',
      guidelinePMID: '29470322',
      requiredDose: '1 mg/kg/day (NASPGHAN standard starting dose for infantile erosive GERD)',
    },
    timeline: [
      { label: 'PA Filed',       date: 'May 28, 2026', status: 'done'    as const, note: 'Non-formulary liquid'  },
      { label: 'Denial',         date: 'Jun 3, 2026',  status: 'done'    as const, note: 'Step therapy required' },
      { label: 'Appeal Filed',   date: 'Jun 9, 2026',  status: 'done'    as const, note: 'Round 1 submitted'     },
      { label: 'Payer Response', date: 'Jun 10, 2026', status: 'flagged' as const, note: 'Partial approval'      },
    ],
    payerResponseAnalysis: {
      responseType: 'partial_approval' as const,
      aiFlag: 'Authorized dose (0.5 mg/kg/day) is below evidence-based therapeutic threshold',
      aiRationale: "NASPGHAN/ESPGHAN 2018 guidelines (PMID 29470322) establish 0.7–1.4 mg/kg/day as the minimum effective range for infantile erosive GERD. At the authorized dose, acid suppression is predicted insufficient for this patient's confirmed Grade B esophagitis. Accepting may require a follow-up PA within 30 days.",
      ctaAccept: 'Accept Partial Approval',
      ctaDispute: 'Dispute Dosing Restriction',
    },
    configJson: `{
  "policy_id": "omeprazole-uhc-pediatric-v1",
  "target_drug": "omeprazole",
  "carrier": "unitedhealthcare",
  "formulary_class": "non_formulary_compounded",
  "patient_age_rules": [
    { "condition": "age_months <= 12", "tablet_contraindicated": true, "required_formulation": "oral_liquid" }
  ],
  "formulary_alternative_exceptions": [
    { "drug": "ranitidine", "exception_reason": "FDA_market_withdrawal_NDMA_April_2020", "status": "unavailable" }
  ],
  "diagnostic_rules": [
    { "condition_category": "GERD", "icd10": "K21.0", "must_be_present": true }
  ],
  "conservative_therapy_rules": [
    { "intervention": "positioning_thickened_feeds", "minimum_trial_weeks": 2, "allows_attestation_bypass": false }
  ]
}`,
  },
}

// ---------------------------------------------------------------------------
// Operating tenant — the single customer whose PA team uses the Operate layer.
// The demo operates as one integrated health system; every case below is one of
// this tenant's patients, sourced from its EHR. (Manufacturer/sponsor personas
// get a separate read-only analytics surface, not this operator queue.)
// ---------------------------------------------------------------------------

export const TENANT = {
  name: 'Meridian Health System',
  type: 'Integrated health system',
  source: 'Epic · FHIR',
}

// ---------------------------------------------------------------------------
// Case queue — this tenant's in-flight PA cases (one per patient)
// ---------------------------------------------------------------------------

export const initialClients: Client[] = [
  { id: 4, name: 'Case #PH-3101', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 5, 2026',  scenarioId: 'novo-ozempic-denied',  deadline: 'Due tomorrow',   urgency: 'soon'  },
  { id: 0, name: 'Case #PH-3098', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 17, 2026', scenarioId: 'novo-ozempic-initial', deadline: 'Due in 2 days',  urgency: 'soon'  },
  { id: 1, name: 'Case #PH-3102', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 8, 2026',  scenarioId: 'novo-ozempic',         deadline: 'Due today',      urgency: 'today' },
  { id: 2, name: 'Case #PH-4201', drug: 'Omeprazole Susp.', categoryLabel: 'Gastroenterology', status: 'payer_response',   clientType: 'patient', lastUpdated: 'Jun 11, 2026', scenarioId: 'infant-omeprazole',    deadline: 'Due in 4 days',  urgency: 'later' },
  { id: 3, name: 'Case #PH-2847', drug: 'Livdelzi',         categoryLabel: 'Hepatology',        status: 'exception',        clientType: 'patient', lastUpdated: 'Jun 9, 2026',  scenarioId: 'gilead-livdelzi',      deadline: 'Due today',      urgency: 'today' },
]


// ---------------------------------------------------------------------------
// Shared display helpers
// ---------------------------------------------------------------------------
// Joyride guided tour — 18 steps across all views
// ---------------------------------------------------------------------------


export function getCaseTier(client: Client): CaseTier {
  if (client.status === 'exception') return 'exception'
  if (client.status === 'payer_response') return 'complex'
  return 'routine'
}

// Lifecycle stage of a case, derived from its scenario — the realistic worklist
// dimension that distinguishes a new prior-auth request from an appeal of a
// denial. Single source of truth: the scenario's `lifecycle` field.
export type CaseStage = 'Initial PA' | 'Appeal'
export function getCaseStage(client: Client): CaseStage {
  return scenarios[client.scenarioId]?.lifecycle === 'initial_pa' ? 'Initial PA' : 'Appeal'
}

/** Generates a random PH-NNNN case reference number (4 digits, 1000–9999). */
export function newCaseRef(): string {
  return `PH-${Math.floor(Math.random() * 9000) + 1000}`
}

/** Human-readable status label for the coordinator-facing queue and dashboard. */
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  ready_for_review: 'Ready for Review',
  payer_response:   'Awaiting Payer Response',
  exception:        'Action Required',
  processing:       'Processing',
  submitted:        'Submitted',
}

/** Case names shown in the EvalDashboard active-pipeline strip (derived from initialClients). */
export const PIPELINE_CASE_IDS = ['PH-3102', 'PH-4201', 'PH-2847'] as const
