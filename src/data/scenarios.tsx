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
  "policy_ref": "cnf_360",
  "diagnostic_rules": [
    { "condition_category": "Type 2 Diabetes Mellitus", "must_be_present": true },
    { "condition_category": "Patient age", "operator": ">=", "threshold": 18, "unit": "years" }
  ],
  "safety_rules": [
    { "condition_category": "Concomitant GLP-1 or GLP-1/GIP agonist",
      "must_be_present": false,
      "examples": ["Wegovy", "Trulicity", "Mounjaro", "Saxenda", "Zepbound"] }
  ],
  "custom_rules": [
    { "rule_id": "indication_t2dm_only",
      "description": "Indication must be T2DM glycemic control; weight-loss use is not covered under this policy (Wegovy/Saxenda/Zepbound are governed by a separate obesity-management policy)" }
  ]
}`

// One patient's evidence, shared across the PH-3101 (denied initial PA) → PH-3102
// (appeal) journey. The initial PA is filed with all four criteria satisfied;
// Cigna denies it on an indication-clarification technicality (BMI + weight-management
// note triggers payer scrutiny); the appeal asserts the very same documented evidence.
// Single source of truth so both stages can't drift apart.
//
// cnf_360 criteria (no HbA1c threshold, no metformin step therapy, no MTC gate):
//   1. Confirmed T2DM diagnosis
//   2. Patient age ≥ 18
//   3. No concomitant GLP-1 or GLP-1/GIP agonist
//   4. Indication limited to T2DM glycemic control (not weight loss) — needs_review
const ozempicCriteria: CriterionResult[] = [
  {
    rule: { type: 'diagnostic', label: 'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)' },
    status: 'found',
    note: 'Page 1 — Endocrinology consult confirms T2DM (E11.9), established 2021. ICD-10 documented in chart since 2019; fasting glucose 187 mg/dL confirming active disease.',
    docSource: 'Specialist Consult (Endocrinology)',
  },
  {
    rule: { type: 'diagnostic', label: 'Patient Age ≥ 18 Years (Ozempic Minimum Age Threshold)' },
    status: 'found',
    note: 'Page 1 — Patient DOB 03/14/1972; age 52 at time of request. Cigna cnf_360 minimum age 18 years met.',
    docSource: 'Specialist Consult (Endocrinology)',
  },
  {
    rule: { type: 'safety', label: 'No Concomitant GLP-1 or GLP-1/GIP Agonist on Active Medication List' },
    status: 'found',
    note: 'Page 3 — Current medication list reviewed 03/14/2024: metformin 1000mg BID, lisinopril 10mg, atorvastatin 40mg. No other GLP-1 or GLP-1/GIP agonist (Wegovy, Trulicity, Mounjaro, Saxenda, Zepbound) on active list.',
    docSource: 'Medication List',
  },
  {
    rule: { type: 'custom', label: 'Indication Confirmed as T2DM Glycemic Control (Not Weight Loss)' },
    status: 'needs_review',
    note: 'Chart includes BMI 33.2 kg/m² and notation "weight management goals discussed" from 01/10/2024 visit. Cigna cnf_360 excludes weight-loss use — payer requests prescriber attestation that Ozempic is prescribed solely for T2DM glycemic control.',
    docSource: 'Office Visit Notes',
    suggestedAction: 'Obtain a brief prescriber attestation confirming Ozempic is prescribed for T2DM glycemic control (not weight management). The BMI documentation alone does not displace the T2DM indication; a single-sentence clinical rationale from the endocrinologist is sufficient.',
    workflowPlan: {
      action: 'Request prescriber attestation: Ozempic prescribed for T2DM glycemic control only (not weight loss / obesity management)',
      recipient: 'Prescriber (Endocrinology)',
      channel: 'EHR task / fax to clinic',
      turnaround: '2 business days',
    },
  },
]

const ozempicCitations: ScenarioConfig['citations'] = {
  'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)':
    { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Endocrinology consult 02/08/2024 — T2DM (E11.9) established 2021. ICD-10 on file since 2019. Fasting glucose 187 mg/dL confirming active disease.' },
  'Patient Age ≥ 18 Years (Ozempic Minimum Age Threshold)':
    { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Patient DOB 03/14/1972 — age 52 at time of request (03/14/2024). Cigna GLP-1 policy minimum age 18 years met.' },
  'No Concomitant GLP-1 or GLP-1/GIP Agonist on Active Medication List':
    { source: 'Medication List', page: 'p. 3', text: 'Active medication list 03/14/2024: metformin 1000mg BID, lisinopril 10mg, atorvastatin 40mg. No GLP-1 or GLP-1/GIP agonist active.' },
  'Indication Confirmed as T2DM Glycemic Control (Not Weight Loss)':
    { source: 'Office Visit Notes', page: 'p. 2', text: 'Office visit 01/10/2024 — BMI 33.2 kg/m². Note: "weight management goals discussed." Prescriber attestation required confirming T2DM glycemic control as sole indication for Ozempic.' },
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
    denialReason: 'Indication not confirmed as limited to T2DM glycemic control — chart documents BMI 33.2 and weight management goals, which may indicate weight-loss use excluded under cnf_360',
    clientType: 'patient',
    criteriaResults: ozempicCriteria,
    citations: ozempicCitations,
    configJson: ozempicCignaConfigJson,
    timeline: [
      { label: 'PA Filed',      date: 'Jun 5, 2026',  status: 'done'    as const, note: 'Cigna GLP-1 review'    },
      { label: 'Denial',        date: 'Jun 8, 2026',  status: 'done'    as const, note: 'Indication unclear'    },
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
      basis: "CRD pre-check: Cigna requires prior authorization for GLP-1 agonists under CIGNA-C500-2024 (nonformulary GLP-1 tier, cnf_360). PA required for semaglutide — proceed to assemble the request.",
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
        rule: { type: 'diagnostic', label: 'Patient Age ≥ 18 Years (Ozempic Minimum Age Threshold)' },
        status: 'found',
        note: 'Page 1 — Patient DOB 08/22/1985; age 40 at time of request. Cigna cnf_360 minimum age 18 years met.',
        docSource: 'Specialist Consult (Endocrinology)',
      },
      {
        rule: { type: 'safety', label: 'No Concomitant GLP-1 or GLP-1/GIP Agonist on Active Medication List' },
        status: 'found',
        note: 'Page 3 — Medication list reviewed 06/12/2026: metformin 500mg BID, empagliflozin 10mg. No GLP-1 or GLP-1/GIP agonist on active list.',
        docSource: 'Medication List',
      },
      {
        rule: { type: 'custom', label: 'Indication Confirmed as T2DM Glycemic Control (Not Weight Loss)' },
        status: 'found',
        note: 'Page 2 — Prescriber attestation on file: Ozempic prescribed for T2DM glycemic control per ADA 2024 guidelines. No obesity-management indication documented.',
        docSource: 'Office Visit Notes',
      },
    ],
    citations: {
      'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)':
        { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Endocrinology consult 06/12/2026 — T2DM (E11.9) established 2022. HbA1c trend: 8.1% → 8.6% over 12 months on oral therapy.' },
      'Patient Age ≥ 18 Years (Ozempic Minimum Age Threshold)':
        { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Patient DOB 08/22/1985 — age 40 at time of request (06/2026). Cigna GLP-1 policy minimum age 18 years met.' },
      'No Concomitant GLP-1 or GLP-1/GIP Agonist on Active Medication List':
        { source: 'Medication List', page: 'p. 3', text: 'Active medication list 06/12/2026: metformin 500mg BID, empagliflozin 10mg. No GLP-1 or GLP-1/GIP agonist active.' },
      'Indication Confirmed as T2DM Glycemic Control (Not Weight Loss)':
        { source: 'Office Visit Notes', page: 'p. 2', text: 'Prescriber attestation 06/12/2026 — Ozempic prescribed for T2DM glycemic control per ADA 2024 guidelines. No weight-management indication documented.' },
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

  // ── Ozempic family: Cigna initial PA — pre-submission documentation gap ───────
  // PH-3101: AI assembled the PA request from the chart and detected an unresolved
  // required item before submission — the indication criterion (T2DM-only) is
  // needs_review because the chart includes a BMI note + "weight management goals
  // discussed". The request is NOT filed; a prescriber attestation is dispatched
  // first. Once received, PAS submission proceeds without further denial risk.
  'novo-ozempic-docgap': {
    id: 'novo-ozempic-docgap',
    drugKey: 'ozempic',
    configFile: 'ozempic_cigna_base.json',
    drug: 'Ozempic (semaglutide)',
    manufacturer: 'Novo Nordisk',
    plan: 'Cigna Connect 500 PPO',
    planId: 'CIGNA-C500-2024',
    categoryKey: 'endocrinology',
    categoryLabel: 'Endocrinology',
    diagnosis: 'Type 2 Diabetes Mellitus (E11.9)',
    denialReason: 'Pre-submission documentation gap: prescriber attestation of T2DM-only indication required — chart BMI 33.2 and weight management note must be clarified before PA request can be filed',
    clientType: 'patient',
    lifecycle: 'initial_pa',
    paRequired: {
      required: true,
      basis: "CRD pre-check: Cigna requires prior authorization for GLP-1 agonists under CIGNA-C500-2024 (nonformulary GLP-1 tier, cnf_360). PA required for semaglutide — proceed to assemble the request.",
    },
    requestedTherapy: 'Ozempic (semaglutide) 0.5 mg subcutaneous once weekly — 90-day supply, 3 refills',
    criteriaResults: ozempicCriteria,
    citations: ozempicCitations,
    configJson: ozempicCignaConfigJson,
    timeline: [
      { label: 'Order Received',    date: 'Jun 3, 2026', status: 'done'    as const, note: 'Rx from Epic'                 },
      { label: 'PA Required',       date: 'Jun 3, 2026', status: 'done'    as const, note: 'CRD: PA needed'               },
      { label: 'Documentation Gap', date: 'Jun 5, 2026', status: 'flagged' as const, note: 'Indication attestation needed' },
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

  // ── Pediatric GERD: Esomeprazole (Nexium) suspension — multi-round escalation demo ──
  'pediatric-esomeprazole': {
    id: 'pediatric-esomeprazole',
    drugKey: 'esomeprazole',
    configFile: 'esomeprazole_uhc_pediatric.json',
    drug: 'Nexium (esomeprazole) 10mg for Oral Suspension',
    manufacturer: 'AstraZeneca',
    plan: 'UnitedHealthcare Choice Plus',
    planId: 'UHC-CHOICE-2024',
    categoryKey: 'gastroenterology',
    categoryLabel: 'Gastroenterology',
    diagnosis: 'Gastroesophageal Reflux Disease with Erosive Esophagitis — Pediatric (K21.0)',
    denialReason: 'Step therapy not documented — tablet PPI trials (omeprazole, pantoprazole, rabeprazole) required before suspension; swallowing-limitation exception not established',
    clientType: 'patient',
    criteriaResults: [
      {
        rule: { type: 'diagnostic', label: 'Confirmed GERD Diagnosis with Erosive Esophagitis (K21.0)' },
        status: 'found',
        note: 'Page 1 — Pediatric GI consult 05/14/2026 confirms erosive GERD. Upper endoscopy (05/12/2026): Los Angeles Grade B esophagitis.',
        docSource: 'Pediatric GI Consult',
      },
      {
        rule: { type: 'safety', label: 'Documented Oral-Motor Dysphagia — Tablet/Capsule PPIs Cannot Be Safely Swallowed' },
        status: 'found',
        note: 'Page 2 — Speech-language pathology evaluation 05/02/2026 documents oral-motor dysphagia with aspiration risk on solid oral dosage forms. The UHC PPI policy accepts a swallowing limitation as an explicit step-therapy bypass.',
        docSource: 'Speech-Language Pathology Evaluation',
      },
      {
        rule: { type: 'temporal', label: 'Tablet PPI Step Therapy — Omeprazole Trial Aborted for Aspiration; Swallowing-Limitation Bypass Applies' },
        status: 'found',
        note: 'Page 3 — Prescription omeprazole tablet trial (04/2026) discontinued after 6 days due to documented choking/aspiration. Pantoprazole and rabeprazole not separately trialed — the swallowing-limitation bypass removes the three-drug requirement.',
        docSource: 'Outpatient Visit Notes',
      },
      {
        rule: { type: 'temporal', label: 'Conservative Therapy Trial (Dietary/Positioning ≥2 Weeks)' },
        status: 'found',
        note: 'Page 3 — Dietary and positioning measures documented from the 4-week visit. 10-week follow-up confirms persistent erosive disease despite ≥2 weeks of conservative management.',
        docSource: 'Outpatient Visit Notes',
      },
    ],
    citations: {
      'Confirmed GERD Diagnosis with Erosive Esophagitis (K21.0)': {
        source: 'Pediatric GI Consult', page: 'p. 1',
        text: 'Endoscopy 05/12/2026 — Los Angeles Grade B esophagitis confirmed. Pediatric GI assessment: erosive GERD requiring PPI therapy. ICD-10 K21.0.',
      },
      'Documented Oral-Motor Dysphagia — Tablet/Capsule PPIs Cannot Be Safely Swallowed': {
        source: 'Speech-Language Pathology Evaluation', page: 'p. 2',
        text: 'SLP evaluation 05/02/2026 — oral-motor dysphagia with aspiration risk on solid oral dosage forms. Tablet and capsule administration is unsafe; a liquid formulation is required.',
      },
      'Tablet PPI Step Therapy — Omeprazole Trial Aborted for Aspiration; Swallowing-Limitation Bypass Applies': {
        source: 'Outpatient Visit Notes', page: 'p. 3',
        text: 'Omeprazole tablet trial 04/2026 discontinued after 6 days following witnessed choking/aspiration. Per UHC PPI policy, a documented swallowing limitation bypasses the three-drug tablet step therapy.',
      },
      'Conservative Therapy Trial (Dietary/Positioning ≥2 Weeks)': {
        source: 'Outpatient Visit Notes', page: 'p. 3',
        text: '4-week visit — dietary and positioning guidance provided. 10-week follow-up noted persistent regurgitation and erosive disease despite ≥2 weeks of measures.',
      },
    },
    payerCounterOffer: {
      date: 'Jun 10, 2026',
      summary: 'Step-therapy exception granted on the documented swallowing limitation. Authorization approved for Nexium (esomeprazole) for suspension — however, approved dose is limited to 10mg/day.',
      newDenialReason: 'Dose limited to 10mg/day — patient weight (≥20kg) and erosive grade indicate 20mg/day',
      approvedDose: '10mg/day (below the labeled dose for erosive esophagitis at this weight)',
    },
    round2Appeal: {
      keyArgument: 'The authorized 10mg/day esomeprazole dose is sub-therapeutic for a ≥20kg child with confirmed LA Grade B erosive esophagitis. The Nexium pediatric prescribing information specifies 10–20mg once daily for erosive esophagitis in children 1–11 years, with 20mg indicated at ≥20kg and for healing of erosive disease. NASPGHAN/ESPGHAN 2018 pediatric GERD guidelines (PMID 29470322) likewise support full-dose PPI therapy for documented esophagitis. Approval at 10mg/day risks incomplete mucosal healing.',
      guidelineRef: 'Rosen R, et al. Pediatric Gastroesophageal Reflux Clinical Practice Guidelines: Joint Recommendations of NASPGHAN and ESPGHAN. J Pediatr Gastroenterol Nutr. 2018;66(3):516–554.',
      guidelinePMID: '29470322',
      requiredDose: '20mg/day (Nexium labeled dose for erosive esophagitis, child ≥20kg)',
    },
    timeline: [
      { label: 'PA Filed',       date: 'May 28, 2026', status: 'done'    as const, note: 'Suspension · step-therapy exception' },
      { label: 'Denial',         date: 'Jun 3, 2026',  status: 'done'    as const, note: 'Step therapy required'              },
      { label: 'Appeal Filed',   date: 'Jun 9, 2026',  status: 'done'    as const, note: 'Round 1 submitted'                 },
      { label: 'Payer Response', date: 'Jun 10, 2026', status: 'flagged' as const, note: 'Partial approval'                  },
    ],
    payerResponseAnalysis: {
      responseType: 'partial_approval' as const,
      aiFlag: 'Authorized dose (10mg/day) is below the labeled dose for erosive esophagitis at this weight',
      aiRationale: "The Nexium pediatric label and NASPGHAN/ESPGHAN 2018 guidance (PMID 29470322) support 20mg/day for a ≥20kg child with LA Grade B erosive esophagitis. At 10mg/day, mucosal healing is predicted incomplete. Accepting may require a follow-up PA within 30 days.",
      ctaAccept: 'Accept Partial Approval',
      ctaDispute: 'Dispute Dosing Restriction',
    },
    configJson: `{
  "policy_id": "esomeprazole-uhc-pediatric-v1",
  "target_drug": "esomeprazole",
  "carrier": "unitedhealthcare",
  "formulary_class": "step_therapy_ppi_suspension",
  "auto_process_rule": { "under_age": 6, "pa_required": false },
  "step_therapy_rules": [
    { "required_agents": ["omeprazole", "pantoprazole", "rabeprazole"], "form": "tablet_capsule", "logic": "all_of", "bypass": "swallowing_limitation" }
  ],
  "swallowing_limitation_bypass": [
    { "reason": "oral_motor_difficulty", "accepted": true },
    { "reason": "dysphagia", "accepted": true }
  ],
  "diagnostic_rules": [
    { "condition_category": "GERD", "icd10": "K21.0", "must_be_present": true }
  ],
  "conservative_therapy_rules": [
    { "intervention": "dietary_positioning", "minimum_trial_weeks": 2, "allows_attestation_bypass": false }
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
  { id: 4, name: 'Case #PH-3101', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'exception',        clientType: 'patient', lastUpdated: 'Jun 5, 2026',  scenarioId: 'novo-ozempic-docgap',  deadline: 'Due tomorrow',   urgency: 'soon'  },
  { id: 0, name: 'Case #PH-3098', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 17, 2026', scenarioId: 'novo-ozempic-initial', deadline: 'Due in 2 days',  urgency: 'soon'  },
  { id: 1, name: 'Case #PH-3102', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 8, 2026',  scenarioId: 'novo-ozempic',         deadline: 'Due today',      urgency: 'today' },
  { id: 2, name: 'Case #PH-4201', drug: 'Esomeprazole Susp.', categoryLabel: 'Gastroenterology', status: 'payer_response',   clientType: 'patient', lastUpdated: 'Jun 11, 2026', scenarioId: 'pediatric-esomeprazole', deadline: 'Due in 4 days',  urgency: 'later' },
  { id: 3, name: 'Case #PH-2847', drug: 'Livdelzi',         categoryLabel: 'Hepatology',        status: 'exception',        clientType: 'patient', lastUpdated: 'Jun 9, 2026',  scenarioId: 'gilead-livdelzi',      deadline: 'Due today',      urgency: 'today' },
]


// ---------------------------------------------------------------------------
// Shared display helpers
// ---------------------------------------------------------------------------
// Joyride guided tour — 18 steps across all views
// ---------------------------------------------------------------------------


export function getCaseTier(client: Client): CaseTier {
  if (client.status === 'exception') return 'exception'
  if (client.status === 'awaiting_documentation') return 'complex'
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
  ready_for_review:       'Ready for Review',
  payer_response:         'Awaiting Payer Response',
  exception:              'Action Required',
  awaiting_documentation: 'Awaiting Documentation',
  processing:             'Processing',
  submitted:              'Submitted',
}

/** Case names shown in the EvalDashboard active-pipeline strip (derived from initialClients). */
export const PIPELINE_CASE_IDS = ['PH-3102', 'PH-4201', 'PH-2847'] as const
