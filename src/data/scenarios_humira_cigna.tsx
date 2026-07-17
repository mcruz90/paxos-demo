// SYNTHETIC — NO PHI. Standalone data module for the adalimumab (Humira) /
// rheumatoid arthritis / Cigna appeal scenario. Authored from the real Cigna
// Drug Coverage Policy IP0652 (Inflammatory Conditions – Adalimumab Products
// Prior Authorization Policy, effective 05/01/2026). See the backend anchor
// `humira_cigna` (golden/policies/humira_cigna.md + provenance.json).
//
// Registration is done by the maintainer in src/data/scenarios.tsx — this file
// intentionally does NOT touch that index. Wire it with:
//   import { scenarioHumiraCigna } from './scenarios_humira_cigna'
//   // then add to the `scenarios` record:  'humira-cigna': scenarioHumiraCigna,
//
// Patient: Yvonne M. Castellano (synthetic, closed identity pool). All values
// invented — no real patient data.
import { type CriterionResult, type PatientContext, type ScenarioConfig } from '../types'

// The registry pack for the Humira × Cigna RA policy. policy_ref ip_0652 is the
// authored golden-set anchor. The preferred-product gate is a formulary step
// (brand Humira non-preferred) distinct from the clinical DMARD/rheumatologist
// criteria; its exception detail lives in Cigna's cross-referenced Preferred
// Specialty Management policy (PSM013).
export const humiraCignaConfigJson = `{
  "policy_id": "humira-cigna-ip0652-v1",
  "target_drug": "adalimumab",
  "carrier": "cigna",
  "policy_ref": "ip_0652",
  "indication": "Rheumatoid Arthritis",
  "diagnostic_rules": [
    { "condition_category": "Rheumatoid Arthritis (seropositive, moderately-to-severely active)", "must_be_present": true },
    { "condition_category": "Patient age", "operator": ">=", "threshold": 18, "unit": "years" }
  ],
  "temporal_rules": [
    { "intervention_target": "conventional synthetic DMARD (e.g. methotrexate)", "minimum_duration_days": 90, "allows_intolerance_bypass": true,
      "exception": "waived if a >=3-month trial of a biologic other than the requested medication is documented; a biosimilar of the requested biologic does not count" }
  ],
  "provider_rules": [
    { "required_specialty": "Rheumatology", "must_be_ordering_provider": false, "accepts_cosignature": true }
  ],
  "safety_rules": [
    { "condition_category": "Concurrent biologic or targeted synthetic oral small molecule drug", "must_be_present": false,
      "note": "conventional synthetic DMARDs (methotrexate, leflunomide, hydroxychloroquine, sulfasalazine) ARE permitted in combination" }
  ],
  "custom_rules": [
    { "rule_id": "preferred_product_exception",
      "description": "Brand Humira is a non-preferred adalimumab product; IP0652 requires trial/use of preferred adalimumab products before a non-preferred one (p.5 NOTE). Exception criteria are adjudicated under the Preferred Specialty Management policy (PSM013)." }
  ]
}`

// Synthetic patient identity — closed golden-set pool (anchor humira_cigna).
const humiraCignaPatient: PatientContext = {
  patientName: 'Yvonne M. Castellano',
  patientDob: '1968-05-19',
  patientSex: 'F',
  memberId: 'CGN00456789',
  groupId: 'GRP-78022',
  patientAddress: '58 Larkspur Hollow, Asheville, NC 28801',
  prescriberName: 'Dr. Helena Brandt, MD',
  prescriberNpi: '4567890123',
  prescriberSpecialty: 'Rheumatology',
  prescriberAddress: '455 Vanderbilt Medical Parkway, Asheville, NC 28803',
  prescriberPhone: '(828) 555-0413',
}

// IP0652 RA criteria (§7.A) are all met; the crux is the preferred-product
// (formulary) exception for non-preferred brand Humira.
export const humiraCignaCriteria: CriterionResult[] = [
  {
    rule: { type: 'diagnostic', label: 'Confirmed Diagnosis: Seropositive Rheumatoid Arthritis (M05.79)' },
    status: 'found',
    note: 'Rheumatology consult 09/12/2025 — RF positive (78 IU/mL), anti-CCP positive (>250 U/mL), CDAI 28 (high activity). ICD-10 M05.79 on file since 2021. Meets ACR/EULAR 2010 classification for moderately-to-severely active RA.',
    docSource: 'Specialist Consult (Rheumatology)',
    confidence: 0.97,
  },
  {
    rule: { type: 'diagnostic', label: 'Patient Age ≥ 18 Years (IP0652 §7.A.i)' },
    status: 'found',
    note: 'Patient DOB 05/19/1968; age 58 at time of request. Cigna IP0652 rheumatoid arthritis minimum age 18 years met.',
    docSource: 'Specialist Consult (Rheumatology)',
    confidence: 0.99,
  },
  {
    rule: { type: 'temporal', label: 'Conventional Synthetic DMARD Trial ≥ 3 Months — Methotrexate (IP0652 §7.A.ii)' },
    status: 'found',
    note: 'Methotrexate 20 mg weekly from 02/2024 through 01/2025 (11 months) with inadequate monotherapy response (CDAI remained > 22). Satisfies the one-conventional-synthetic-DMARD ≥ 3-month requirement. Methotrexate continued in combination — expressly permitted (Conditions Not Covered §1 Note).',
    docSource: 'Medication History',
    confidence: 0.96,
  },
  {
    rule: { type: 'provider', label: 'Prescribed by or in Consultation with a Rheumatologist (IP0652 §7.A.iii)' },
    status: 'found',
    note: 'Dr. Helena Brandt, MD — Rheumatology (NPI 4567890123), board-certified. Satisfies the specialist-prescriber requirement for adalimumab in RA.',
    docSource: 'PA Request Form',
    confidence: 0.97,
  },
  {
    rule: { type: 'custom', label: 'Preferred-Product Step Therapy / Exception — Non-Preferred Brand Humira' },
    status: 'needs_review',
    note: 'Denial basis: brand Humira is a NON-PREFERRED adalimumab product. IP0652 (p.5 NOTE) requires trial/use of preferred adalimumab products before a non-preferred one, and lists Humira (NDCs starting 83457) as not covered. Patient was established on brand Humira ≥ 6 months with beneficial response, then had a documented loss of response and injection-site reactions after a plan-mandated switch to the preferred adalimumab biosimilar (adalimumab-adbm, Cyltezo) in 06/2025 — supporting a medical-necessity exception. The exception is adjudicated under the cross-referenced Preferred Specialty Management policy (PSM013), whose criteria are not fully in the submitted record.',
    docSource: 'Cigna Coverage Determination Letter',
    confidence: 0.71,
    suggestedAction: 'Submit the documented preferred-product failure (loss of response + injection-site reactions on adalimumab-adbm/Cyltezo, 06/2025) with the appeal and request adjudication of the medical-necessity exception under PSM013. Attach the prior Humira response record establishing prior stabilization to frame this as non-medical switching.',
    workflowPlan: {
      action: 'Assemble preferred-product exception packet: prior Humira response + documented biosimilar (adalimumab-adbm) failure/intolerance; cite IP0652 preferred-product NOTE + PSM013 exception pathway',
      recipient: 'Cigna National Appeals Unit (Express Scripts specialty)',
      channel: 'CignaforHCP.com portal / fax',
      turnaround: '3 business days',
    },
  },
]

export const humiraCignaCitations: ScenarioConfig['citations'] = {
  'Confirmed Diagnosis: Seropositive Rheumatoid Arthritis (M05.79)':
    { source: 'Specialist Consult (Rheumatology)', page: 'p. 1', text: 'Rheumatology consult 09/12/2025 — RF positive 78 IU/mL, anti-CCP positive >250 U/mL, CDAI 28. ICD-10 M05.79 documented since 2021. Moderately-to-severely active seropositive RA.' },
  'Patient Age ≥ 18 Years (IP0652 §7.A.i)':
    { source: 'Cigna IP0652 Policy', page: 'p. 8', text: 'Rheumatoid Arthritis, Initial Therapy §7.A.i: "Patient is ≥ 18 years of age." Patient DOB 05/19/1968 — age 58 at request.' },
  'Conventional Synthetic DMARD Trial ≥ 3 Months — Methotrexate (IP0652 §7.A.ii)':
    { source: 'Cigna IP0652 Policy', page: 'p. 8', text: '§7.A.ii: "Patient has tried ONE conventional synthetic disease-modifying antirheumatic drug (DMARD) for at least 3 months." Methotrexate 20 mg weekly 02/2024–01/2025 (11 months), inadequate response.' },
  'Prescribed by or in Consultation with a Rheumatologist (IP0652 §7.A.iii)':
    { source: 'Cigna IP0652 Policy', page: 'p. 9', text: '§7.A.iii: "The medication is prescribed by or in consultation with a rheumatologist." Dr. Helena Brandt, MD — Rheumatology, NPI 4567890123.' },
  'Preferred-Product Step Therapy / Exception — Non-Preferred Brand Humira':
    { source: 'Cigna IP0652 Policy', page: 'p. 5', text: 'NOTE: "This product also requires the use of preferred products before approval of a requested non-preferred adalimumab product. Refer to the [Preferred Specialty Management Policy] (PSM003/PSM013/PSM014) for additional preferred product criteria requirements and exceptions." Humira (NDCs starting 83457) listed as not covered.' },
}

export const scenarioHumiraCigna: ScenarioConfig = {
  id: 'humira-cigna',
  drugKey: 'humira',
  configFile: 'humira_cigna_ip0652.json',
  drug: 'Humira (adalimumab)',
  manufacturer: 'AbbVie',
  plan: 'Cigna Connect 3000 PPO',
  planId: 'CIGNA-IP0652-2026',
  categoryKey: 'rheumatology',
  categoryLabel: 'Rheumatology',
  diagnosis: 'Rheumatoid Arthritis (M05.79)',
  denialReason: 'Brand Humira is a non-preferred adalimumab product — Cigna IP0652 requires trial/use of preferred adalimumab products before a non-preferred one (p.5 NOTE; Humira NDCs starting 83457 listed not-covered). Preferred-product step therapy not satisfied on the face of the request.',
  clientType: 'patient',
  criteriaResults: humiraCignaCriteria,
  citations: humiraCignaCitations,
  configJson: humiraCignaConfigJson,
  patientContext: humiraCignaPatient,
  // EHR auto-verify fixture: the scenario narrative (above) documents the
  // plan-mandated switch to adalimumab-adbm (06/2025) and its failure — the
  // fact a pharmacy-dispense pull would verify for the PSM013 exception.
  ehrVerifications: {
    'Preferred-Product Step Therapy / Exception — Non-Preferred Brand Humira': {
      registry: 'SureScripts dispense history (Epic ingest)',
      finding:
        'Dispense records confirm adalimumab-adbm (Cyltezo) fills beginning 06/2025 after the plan-mandated switch, with discontinuation documented after loss of response and injection-site reactions — verifying the preferred-product trial and failure required for the PSM013 medical-necessity exception.',
    },
  },
  timeline: [
    { label: 'PA Filed',      date: 'Jun 24, 2026', status: 'done'    as const, note: 'Cigna specialty PA (Humira)'          },
    { label: 'Denial',        date: 'Jun 27, 2026', status: 'done'    as const, note: 'Non-preferred — preferred step unmet' },
    { label: 'Appeal Review', date: 'Pending',       status: 'pending' as const, note: 'Preferred-product exception packet'  },
  ],
}
