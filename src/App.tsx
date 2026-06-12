import { useState, useRef, useEffect } from 'react'
import { Joyride, type Step, EVENTS, STATUS, ACTIONS } from 'react-joyride'
import {
  LayoutDashboard, Library, Plus, Activity, Settings, Clock, ShieldAlert,
  Upload, FileText, CheckCircle, Loader2, Users, Zap, ChevronRight,
  Building2, User, AlertTriangle, Search, Pill, Shield,
  Download, RotateCcw, Code, Package, ChevronDown, ChevronLeft, BookmarkPlus,
  Info, GitBranch, Pencil,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = 'portfolio' | 'intake' | 'poc' | 'library'
type IntakePhase = 'upload' | 'analyzing' | 'extracted'
type ClientType = 'medtech' | 'patient'
type RuleType = 'diagnostic' | 'temporal' | 'math' | 'safety'
type SimPhase = 'idle' | 'loading' | 'done' | 'review' | 'submitted' | 'round2_loading' | 'round2_done' | 'round2_submitted'
type CriterionStatus = 'found' | 'needs_review'
type CaseStatus = 'processing' | 'ready_for_review' | 'exception' | 'submitted' | 'payer_response'

interface Rule {
  type: RuleType
  label: string
}

interface WorkflowPlan {
  action: string
  recipient: string
  channel: string
  turnaround: string
}

interface CriterionResult {
  rule: Rule
  status: CriterionStatus
  note: string
  docSource: string
  suggestedAction?: string
  workflowPlan?: WorkflowPlan
}

interface ScenarioConfig {
  id: string
  configFile: string
  drug: string
  manufacturer: string
  plan: string
  planId: string
  categoryKey: string
  categoryLabel: string
  diagnosis: string
  denialReason: string
  clientType: ClientType
  criteriaResults: CriterionResult[]
  citations: Record<string, { source: string; page: string; text: string }>
  configJson: string
  // Config hierarchy
  drugKey: string            // groups same drug across carrier configs
  parentConfigId?: string    // if set, this config is a plan-specific override of the parent
  overriddenFields?: { label: string; base: string; override: string }[]
  // Multi-round appeal support
  payerCounterOffer?: { date: string; summary: string; newDenialReason: string; approvedDose: string }
  round2Appeal?: { keyArgument: string; guidelineRef: string; guidelinePMID: string; requiredDose: string }
}

interface Client {
  id: number
  name: string
  drug: string
  categoryLabel: string
  status: CaseStatus
  clientType: ClientType
  lastUpdated: string
  scenarioId: string
}

// ---------------------------------------------------------------------------
// Layer 1 — Universal Rule Primitives
// ---------------------------------------------------------------------------

const universalPrimitives = [
  {
    type: 'diagnostic' as RuleType,
    schemaClass: 'DiagnosticRule',
    name: 'Diagnostic Rule',
    description: 'Confirms the presence or absence of a clinical diagnosis. The retrieval agent scans ICD codes, specialist consult notes, and attending physician documentation.',
    params: ['condition_category: str', 'must_be_present: bool'],
  },
  {
    type: 'math' as RuleType,
    schemaClass: 'BiomarkerRule',
    name: 'Biomarker / Math Rule',
    description: 'Compares an extracted lab value against a threshold. Supports absolute values, multiples of the upper limit of normal (ULN), and recency windows on lab dates.',
    params: ['biomarker_name: str', 'operator: Literal[">=","<=","==",">","<"]', 'absolute_threshold: float | None', 'multiplier_of_uln: float | None', 'max_age_days: int'],
  },
  {
    type: 'temporal' as RuleType,
    schemaClass: 'TemporalRule',
    name: 'Temporal Rule',
    description: 'Verifies that a prior line of therapy was administered for a minimum duration. Supports clinical intolerance as a documented bypass condition.',
    params: ['intervention_target: str', 'minimum_duration_days: int', 'allows_intolerance_bypass: bool'],
  },
  {
    type: 'safety' as RuleType,
    schemaClass: 'DiagnosticRule (must_be_present=False)',
    name: 'Safety / Contraindication Rule',
    description: 'A hard exclusion gate. If the contraindicated condition is documented in the chart, the pipeline halts and returns Denied — regardless of other criteria.',
    params: ['condition_category: str', 'must_be_present: False  # always False for safety gates'],
  },
]

// ---------------------------------------------------------------------------
// Layer 2 — Drug × Carrier Configurations
// ---------------------------------------------------------------------------

const scenarios: Record<string, ScenarioConfig> = {
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
    clientType: 'medtech',
    criteriaResults: [
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
    ],
    citations: {
      'Confirmed Diagnosis: Type 2 Diabetes Mellitus (T2DM)':
        { source: 'Specialist Consult (Endocrinology)', page: 'p. 1', text: 'Endocrinology consult 02/08/2024 — T2DM established 2021. HbA1c trend: 7.9% → 8.2% over 18 months.' },
      'HbA1c >= 7.5% on Current Oral Regimen':
        { source: 'Lab Report', page: 'p. 4', text: 'Lab report 03/14/2024 — HbA1c: 8.2% (threshold ≥7.5%). Result confirmed.' },
      'Metformin Therapy >= 90 Consecutive Days at Maximum Tolerated Dose':
        { source: 'Pharmacy Records', page: 'p. 3', text: 'Pharmacy refill record confirms Metformin 1000mg BID — 112 consecutive days prior to referral.' },
      'NO Personal or Family History of Medullary Thyroid Carcinoma (MTC)':
        { source: 'Medical History', page: 'p. 2', text: 'Oncology history — No personal or family history of MTC or MEN2 syndrome. Thyroid ultrasound negative.' },
    },
    configJson: `{
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
}`,
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
// Mock client portfolio
// ---------------------------------------------------------------------------

const initialClients: Client[] = [
  { id: 1, name: 'Case #PH-3102', drug: 'Ozempic',          categoryLabel: 'Endocrinology',    status: 'ready_for_review', clientType: 'patient', lastUpdated: 'Jun 8, 2026',  scenarioId: 'novo-ozempic' },
  { id: 2, name: 'Case #PH-4201', drug: 'Omeprazole Susp.', categoryLabel: 'Gastroenterology', status: 'payer_response',   clientType: 'patient', lastUpdated: 'Jun 11, 2026', scenarioId: 'infant-omeprazole' },
]


// ---------------------------------------------------------------------------
// Shared display helpers
// ---------------------------------------------------------------------------
// Joyride guided tour — 18 steps across all views
// ---------------------------------------------------------------------------

const tc = (body: string, note?: string) => (
  <div>
    <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{body}</p>
    {note && <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>{note}</p>}
  </div>
)

const TOUR_STEPS: Step[] = [
  // ── Step 0: Welcome ──────────────────────────────────────────────────────
  {
    target: 'body',
    placement: 'center',
    skipBeacon: true,
    title: 'PaxOS Case Walkthrough',
    content: tc(
      'This tour walks through two adversarial PA cases from start to finish — an Ozempic step therapy fight and a multi-round infant omeprazole dispute. You\'ll see the AI output, the clinical evidence, and the human authorization step.',
      '10 steps · arrows to navigate · Esc to exit'
    ),
  },
  // ── Step 1: Portfolio ─────────────────────────────────────────────────────
  {
    target: '#tour-portfolio-list',
    placement: 'right',
    skipBeacon: true,
    title: 'Two Active Cases',
    content: tc(
      'Case 1 (Ozempic): the AI pipeline already ran and the appeal is waiting for AM authorization. Case 2 (infant omeprazole): the payer responded with a counter-offer — a second pipeline run is needed to rebut it.',
      "Both cases are adversarial. The payer's denial argument has a specific legal/clinical weakness the system exploits."
    ),
  },
  // ── Step 2: Ozempic case card ─────────────────────────────────────────────
  {
    target: '#tour-case-ozempic',
    placement: 'right',
    skipBeacon: true,
    title: 'Case 1 — Ozempic Step Therapy Denial',
    content: tc(
      "Cigna denied Ozempic claiming the patient hadn't documented sufficient Metformin therapy. But pharmacy fill records show 112 consecutive days of Metformin 1000mg BID — exceeding the 90-day threshold Cigna requires.",
      "Next: open the case and see how the pipeline built the argument."
    ),
  },
  // ── Step 3: Ozempic POC — pipeline header ────────────────────────── (after view transition)
  {
    target: '#tour-pipeline-header',
    placement: 'bottom',
    skipBeacon: true,
    title: 'Pipeline Complete — Ozempic',
    content: tc(
      "Config: ozempic_cigna_base.json. The 4-node DAG ran: Ingestion identified the step therapy denial type, Retrieval loaded Cigna's GLP-1 PA policy, Synthesis drafted the letter, and the Gatekeeper ran 5 deterministic checks (no LLM).",
    ),
  },
  // ── Step 4: Completed trail ───────────────────────────────────────────────
  {
    target: '#tour-pipeline-trail',
    placement: 'top',
    skipBeacon: true,
    title: 'All 4 Nodes Passed',
    content: tc(
      'Each node is visible and auditable. The Gatekeeper is deterministic — pure rule logic, no model involved. It verified drug name, diagnosis, denial reason, all 4 criteria cited, and minimum letter length. All passed.',
      'Click any completed node to read what it found.'
    ),
  },
  // ── Step 5: Extraction audit ──────────────────────────────────────────────
  {
    target: '#tour-criteria-audit',
    placement: 'top',
    skipBeacon: true,
    title: 'All 4 PA Criteria Met',
    content: tc(
      'T2DM confirmed (E11.9), HbA1c 8.2% (threshold 7.5%), Metformin 112 days (threshold 90), no medullary thyroid carcinoma history. Every criterion maps to a source document and page number.',
    ),
  },
  // ── Step 6: Approve button ────────────────────────────────────────────────
  {
    target: '#tour-review-btn',
    placement: 'top',
    skipBeacon: true,
    title: 'Human Authorization — AM is the Final Gate',
    content: tc(
      "The AM reviews the letter, confirms every citation, and clicks Approve. Nothing is transmitted to Cigna until a human authorizes it. The AI generates; the AM decides.",
      'Next: Case 2 — the infant omeprazole counter-offer.'
    ),
  },
  // ── Step 7: Infant case card ──────────────────────────────────────────────
  {
    target: '#tour-case-infant',
    placement: 'right',
    skipBeacon: true,
    title: 'Case 2 — Infant Omeprazole, Round 2',
    content: tc(
      "Round 1 won the formulary exception — UHC agreed to cover the liquid formulation. But they capped the dose at 0.5 mg/kg/day. NASPGHAN 2018 guidelines require 1 mg/kg/day for infantile GERD. The payer's counter-offer is clinically inadequate.",
      'Next: see the payer response and the round 2 argument.'
    ),
  },
  // ── Step 8: Payer response card ───────────────────────────── (after view transition)
  {
    target: '#tour-payer-response',
    placement: 'top',
    skipBeacon: true,
    title: 'Counter-Offer: Dose Capped at 0.5 mg/kg/day',
    content: tc(
      "UHC granted the formulary exception but authorized half the therapeutic dose. The new denial basis is 'dose exceeds standard protocol.' The round 2 argument targets this claim directly: NASPGHAN 2018 (PMID 29470322) establishes 1 mg/kg/day as the evidence-based standard for this patient's age and weight.",
    ),
  },
  // ── Step 9: Round 2 execute ───────────────────────────────────────────────
  {
    target: '#tour-round2-execute',
    placement: 'top',
    skipBeacon: true,
    title: 'Generate Round 2 Counter-Argument',
    content: tc(
      'The same 4-node pipeline reruns, this time scoped to the dose dispute. Synthesis will draft three tightly targeted sections: the clinical basis (NASPGHAN dosing standard), the supporting guideline (PMID), and the specific authorization requested (1 mg/kg/day for 90 days).',
      'After the pipeline runs, each letter section highlights bidirectionally with its citation in the panel on the right.'
    ),
  },
]

const JOYRIDE_STYLES: import('react-joyride').PartialDeep<import('react-joyride').Styles> = {
  tooltip: {
    borderRadius: 12,
    border: '1px solid rgba(51,65,85,0.9)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    padding: 0,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9',
    padding: '18px 18px 10px',
    margin: 0,
  },
  tooltipContent: {
    padding: '0 18px 4px',
  },
  tooltipFooter: {
    padding: '12px 18px 16px',
    marginTop: 0,
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    padding: '7px 14px',
  },
  buttonBack: {
    color: '#64748b',
    fontSize: 13,
    marginRight: 4,
  },
  buttonSkip: {
    color: '#475569',
    fontSize: 12,
  },
  buttonClose: {
    color: '#475569',
  },
}

// ---------------------------------------------------------------------------

const ruleIcons: Record<RuleType, React.ReactNode> = {
  diagnostic: <Activity className="w-4 h-4" />,
  math:       <Settings className="w-4 h-4" />,
  temporal:   <Clock className="w-4 h-4" />,
  safety:     <ShieldAlert className="w-4 h-4" />,
}

const ruleColors: Record<RuleType, string> = {
  diagnostic: 'text-slate-300 bg-slate-700/30 border-slate-600/30',
  math:       'text-slate-300 bg-slate-700/30 border-slate-600/30',
  temporal:   'text-slate-300 bg-slate-700/30 border-slate-600/30',
  safety:     'text-slate-300 bg-slate-700/30 border-slate-600/30',
}

function RuleTag({ type }: { type: RuleType }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${ruleColors[type]}`}>
      {ruleIcons[type]}
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const config: Record<CaseStatus, { label: string; className: string }> = {
    processing:       { label: 'Processing',        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    ready_for_review: { label: 'Ready for Review',  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    exception:        { label: 'Exception',         className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    submitted:        { label: 'Submitted',         className: 'bg-slate-600/30 text-slate-400 border-slate-600/30' },
    payer_response:   { label: 'Payer Response',    className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  }
  const { label, className } = config[status]
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}

function ClientTypePill({ type }: { type: ClientType }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-slate-700/30 text-slate-400 border-slate-600/30">
      {type === 'patient' ? <User className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
      {type === 'patient' ? 'Patient' : 'MedTech'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({ view, setView, onStartTour }: { view: View; setView: (v: View) => void; onStartTour: () => void }) {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">PaxOS</p>
            <p className="text-xs text-slate-500 mt-0.5">AM Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {([
          ['portfolio', LayoutDashboard, 'Portfolio'],
          ['library',   Library,         'Ontology Library'],
        ] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            id={v === 'library' ? 'tour-sidebar-library' : undefined}
            onClick={() => setView(v)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              view === v
                ? 'bg-slate-700/80 text-white font-medium'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800 space-y-1">
        <button
          onClick={onStartTour}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Activity className="w-4 h-4" />
          Guided Tour
        </button>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">AM Dashboard</p>
            <p className="text-xs text-slate-500">Enterprise</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// View 1 — Client Portfolio
// ---------------------------------------------------------------------------

function PortfolioView({ clients, onNew, onOpenCase }: {
  clients: Client[]
  onNew: () => void
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<CaseStatus | null>(null)

  const readyCount         = clients.filter(c => c.status === 'ready_for_review').length
  const exceptionCount     = clients.filter(c => c.status === 'exception').length
  const payerResponseCount = clients.filter(c => c.status === 'payer_response').length
  const submittedCount     = clients.filter(c => c.status === 'submitted').length
  const processingCount    = clients.filter(c => c.status === 'processing').length
  const actionableCount    = readyCount + exceptionCount + payerResponseCount

  const statusOrder: Record<CaseStatus, number> = { exception: 0, payer_response: 0, ready_for_review: 1, submitted: 2, processing: 3 }

  const filtered = clients
    .filter(c =>
      (!statusFilter || c.status === statusFilter) &&
      [c.name, c.drug, c.categoryLabel].some(v => v.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  const toggleFilter = (status: CaseStatus) =>
    setStatusFilter(prev => prev === status ? null : status)

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Client Portfolio</h1>
          <p className="text-sm mt-0.5 flex items-center gap-2">
            {actionableCount > 0
              ? <span className="text-white font-medium">{actionableCount} case{actionableCount !== 1 ? 's' : ''} need your attention</span>
              : <span className="text-slate-400">All cases up to date</span>}
            {submittedCount > 0 && <><span className="text-slate-700">·</span><span className="text-slate-500 text-xs">{submittedCount} submitted</span></>}
            {processingCount > 0 && <><span className="text-slate-700">·</span><span className="text-blue-400/60 text-xs">{processingCount} processing</span></>}
          </p>
        </div>
        <button
          id="tour-new-case-btn"
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />New Case
        </button>
      </div>

      {/* Attention cards — only shown when actionable cases exist */}
      {actionableCount > 0 && (
        <div className="px-8 pt-5 pb-1 grid grid-cols-2 gap-3 max-w-2xl">
          {readyCount > 0 && (
            <button
              onClick={() => toggleFilter('ready_for_review')}
              className={`text-left rounded-xl p-4 border transition-all ${
                statusFilter === 'ready_for_review'
                  ? 'bg-emerald-950/60 border-emerald-500/50 ring-1 ring-emerald-500/30'
                  : 'bg-emerald-950/30 border-emerald-500/20 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xl font-bold text-emerald-400">{readyCount}</span>
                <span className="text-sm font-medium text-emerald-300">Ready for Review</span>
              </div>
              <p className="text-xs text-emerald-400/60 leading-snug">
                AI work complete — appeals ready to approve and submit
              </p>
              <p className="text-xs text-emerald-400 mt-2 font-medium">
                {statusFilter === 'ready_for_review' ? '← Clear filter' : 'Show these cases →'}
              </p>
            </button>
          )}
          {exceptionCount > 0 && (
            <button
              onClick={() => toggleFilter('exception')}
              className={`text-left rounded-xl p-4 border transition-all ${
                statusFilter === 'exception'
                  ? 'bg-amber-950/60 border-amber-500/50 ring-1 ring-amber-500/30'
                  : 'bg-amber-950/30 border-amber-500/20 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xl font-bold text-amber-400">{exceptionCount}</span>
                <span className="text-sm font-medium text-amber-300">Exception{exceptionCount !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-xs text-amber-400/60 leading-snug">
                AI flagged gaps — dispatch resolution workflows to unblock
              </p>
              <p className="text-xs text-amber-400 mt-2 font-medium">
                {statusFilter === 'exception' ? '← Clear filter' : 'Show these cases →'}
              </p>
            </button>
          )}
          {payerResponseCount > 0 && (
            <button
              onClick={() => toggleFilter('payer_response')}
              className={`text-left rounded-xl p-4 border transition-all ${
                statusFilter === 'payer_response'
                  ? 'bg-violet-950/60 border-violet-500/50 ring-1 ring-violet-500/30'
                  : 'bg-violet-950/30 border-violet-500/20 hover:border-violet-500/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <RotateCcw className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-xl font-bold text-violet-400">{payerResponseCount}</span>
                <span className="text-sm font-medium text-violet-300">Payer Responded</span>
              </div>
              <p className="text-xs text-violet-400/60 leading-snug">
                Counter-offer received — Round 2 argument ready to file
              </p>
              <p className="text-xs text-violet-400 mt-2 font-medium">
                {statusFilter === 'payer_response' ? '← Clear filter' : 'Show these cases →'}
              </p>
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-8 pt-5 pb-2">
        <div className="relative max-w-sm flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients, drugs, categories..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(null)}
              className="text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap transition-colors"
            >
              Clear filter ✕
            </button>
          )}
        </div>
      </div>

      {/* Case list */}
      <div className="px-8 py-4">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 px-4 py-2 mb-1">
          {['Client / Case', 'Drug', 'Category', 'Type', 'Status', 'Updated'].map(h => (
            <span key={h} className={`text-xs font-medium text-slate-500 uppercase tracking-wide ${h === 'Updated' ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        <div id="tour-portfolio-list" className="space-y-1">
          {filtered.map(client => {
            const isProcessing = client.status === 'processing'
            return (
              <div
                key={client.id}
                id={client.scenarioId === 'novo-ozempic' ? 'tour-case-ozempic' : client.scenarioId === 'infant-omeprazole' ? 'tour-case-infant' : undefined}
                onClick={() => !isProcessing && onOpenCase(client.scenarioId, client.status)}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_100px] gap-4 items-center px-4 py-3.5 rounded-xl border transition-all group ${
                  isProcessing
                    ? 'bg-slate-800/20 border-transparent opacity-50 cursor-default'
                    : 'bg-slate-800/30 hover:bg-slate-800/70 border-transparent hover:border-slate-700/60 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg shrink-0 bg-slate-700 flex items-center justify-center text-xs font-bold">
                    {client.clientType === 'patient'
                      ? <User className="w-4 h-4 text-slate-400" />
                      : <span className="text-white">{client.name[0]}</span>
                    }
                  </div>
                  <span className="text-sm font-medium text-white truncate">{client.name}</span>
                </div>
                <span className="text-sm text-slate-300 truncate">{client.drug}</span>
                <span className="text-sm text-slate-400">{client.categoryLabel}</span>
                <ClientTypePill type={client.clientType} />
                <StatusBadge status={client.status} />
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs text-slate-500">{client.lastUpdated}</span>
                  {!isProcessing && (
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  )}
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center py-12 text-slate-500 text-sm">
              {statusFilter
                ? `No ${statusFilter.replace('_', ' ')} cases`
                : `No clients match “${search}”`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View 2 — Intake
// ---------------------------------------------------------------------------

const analyzeSteps = [
  'Parsing document structure...',
  'Extracting patient and drug identifiers...',
  'Querying formulary database...',
  'Matching ontology configuration...',
  'Pre-checking evidence against criteria...',
  'Complete',
]

function ConfigBanner({ scenario }: { scenario: ScenarioConfig }) {
  return (
    <div id="tour-config-banner" className="flex items-center gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
      <Package className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">config_loaded</p>
        <p className="text-sm text-slate-200 font-mono mt-0.5">{scenario.configFile}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-400">{scenario.categoryLabel}</p>
        <p className="text-xs text-slate-500 font-mono">{scenario.criteriaResults.length} rules</p>
      </div>
    </div>
  )
}

function ExtractedFieldsGrid({ scenario }: { scenario: ScenarioConfig }) {
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editInput, setEditInput] = useState('')

  const startEdit = (label: string, currentValue: string) => {
    setEditInput(currentValue)
    setEditing(label)
  }
  const saveEdit = (label: string) => {
    if (editInput.trim()) setCorrections(prev => ({ ...prev, [label]: editInput.trim() }))
    setEditing(null)
  }
  const cancelEdit = () => setEditing(null)

  const fields: { icon: React.ReactNode; label: string; value: string; danger?: boolean }[] = [
    { icon: <Pill className="w-3.5 h-3.5" />,        label: 'drug',           value: scenario.drug },
    { icon: <Building2 className="w-3.5 h-3.5" />,   label: 'manufacturer',   value: scenario.manufacturer },
    { icon: <Shield className="w-3.5 h-3.5" />,      label: 'insurance_plan', value: scenario.plan },
    { icon: <FileText className="w-3.5 h-3.5" />,    label: 'plan_id',        value: scenario.planId },
    { icon: <Activity className="w-3.5 h-3.5" />,    label: 'diagnosis',      value: scenario.diagnosis },
    { icon: <ShieldAlert className="w-3.5 h-3.5" />, label: 'denial_reason',  value: scenario.denialReason, danger: true },
  ]

  return (
    <div id="tour-extracted-fields" className="grid grid-cols-2 gap-2.5">
      {fields.map(({ icon, label, value, danger }) => {
        const corrected = corrections[label]
        const displayValue = corrected ?? value
        const isEditing = editing === label
        const isCorrected = !!corrected

        const borderClass = isCorrected
          ? 'bg-blue-950/30 border border-blue-500/25'
          : danger
            ? 'bg-rose-950/40 border border-rose-500/20'
            : 'bg-slate-700/20 border border-slate-700/20'

        const labelColor = isCorrected ? 'text-blue-400' : danger ? 'text-rose-400' : 'text-slate-500'
        const valueColor = isCorrected ? 'text-blue-100' : danger ? 'text-rose-200' : 'text-white'

        return (
          <div key={label} className={`rounded-lg px-3 py-2.5 group ${borderClass}`}>
            <div className={`flex items-center gap-1.5 mb-1 font-mono ${labelColor}`}>
              {icon}
              <span className="text-xs">{label}</span>
              <span className="ml-auto">
                {isCorrected ? (
                  <button
                    onClick={() => startEdit(label, displayValue)}
                    className="text-[10px] font-mono text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded transition-colors"
                  >
                    corrected ✎
                  </button>
                ) : (
                  !isEditing && (
                    <button
                      onClick={() => startEdit(label, displayValue)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-600/30"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )
                )}
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-1.5 mt-1">
                <input
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(label); if (e.key === 'Escape') cancelEdit() }}
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => saveEdit(label)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-2 py-0.5 text-slate-400 hover:text-slate-300 border border-slate-700 hover:border-slate-600 rounded text-xs transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm font-medium leading-snug ${valueColor}`}>{displayValue}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CriteriaPrecheck({ scenario }: { scenario: ScenarioConfig }) {
  const found = scenario.criteriaResults.filter(r => r.status === 'found').length
  const needsReview = scenario.criteriaResults.filter(r => r.status === 'needs_review').length
  const [dispatched, setDispatched] = useState<string[]>([])
  const [pendingDispatch, setPendingDispatch] = useState<string[]>([])

  const stagePending = (label: string) => setPendingDispatch(prev => [...prev, label])
  const cancelPending = (label: string) => setPendingDispatch(prev => prev.filter(l => l !== label))
  const confirmDispatch = (label: string) => {
    setDispatched(prev => [...prev, label])
    cancelPending(label)
  }

  const dispatchedCount = dispatched.length

  return (
    <div id="tour-criteria-precheck">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Criteria Pre-check</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />{found} evidence found
          </span>
          {needsReview > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />{needsReview} needs review
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {scenario.criteriaResults.map((cr, i) => {
          const isUnresolved = cr.status === 'needs_review'
          const isDispatched = dispatched.includes(cr.rule.label)
          const isPending = pendingDispatch.includes(cr.rule.label)

          return (
            <div key={i} className={`rounded-xl border overflow-hidden ${
              isDispatched    ? 'border-emerald-500/20 bg-emerald-950/10' :
              isUnresolved    ? 'border-amber-500/20 bg-amber-950/10' :
                                'border-emerald-500/20 bg-emerald-950/10'
            }`}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="shrink-0">
                  {isDispatched
                    ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                    : isUnresolved
                      ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                      : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                  <RuleTag type={cr.rule.type} />
                  <span className="text-sm text-white">{cr.rule.label}</span>
                </div>
              </div>

              {/* Detail rows */}
              <div className={`px-4 py-3 border-t space-y-1 ${
                isDispatched ? 'border-emerald-500/20 bg-emerald-950/20' :
                isUnresolved ? 'border-amber-500/20 bg-amber-950/20' :
                               'border-emerald-500/20 bg-emerald-950/20'
              }`}>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-slate-500 w-20 shrink-0">status</span>
                  <span className={`font-bold tracking-wide ${
                    isDispatched ? 'text-emerald-400' :
                    isUnresolved ? 'text-amber-400' :
                                   'text-emerald-400'
                  }`}>
                    {isDispatched ? 'DISPATCHED' : isUnresolved ? 'UNRESOLVED' : 'SATISFIED'}
                  </span>
                </div>
                <div className="flex items-start gap-3 text-xs font-mono">
                  <span className="text-slate-500 w-20 shrink-0">source_doc</span>
                  <span className="text-slate-300">{cr.docSource}</span>
                </div>
                <div className="flex items-start gap-3 text-xs">
                  <span className="font-mono text-slate-500 w-20 shrink-0 pt-0.5">excerpt</span>
                  <span className="text-slate-400 italic leading-relaxed">{cr.note}</span>
                </div>

                {/* Unresolved extras */}
                {isUnresolved && !isDispatched && cr.suggestedAction && (
                  <div className="flex items-start gap-3 text-xs pt-2 mt-1 border-t border-amber-500/10">
                    <span className="font-mono text-slate-500 w-20 shrink-0 pt-0.5">resolution_path</span>
                    <span className="text-slate-300 leading-relaxed">{cr.suggestedAction}</span>
                  </div>
                )}

                {/* Dispatched confirmation detail */}
                {isDispatched && cr.workflowPlan && (
                  <div className="flex items-start gap-3 text-xs font-mono pt-1">
                    <span className="text-slate-500 w-20 shrink-0">sent_to</span>
                    <span className="text-slate-300">{cr.workflowPlan.recipient} · {cr.workflowPlan.channel}</span>
                  </div>
                )}
              </div>

              {/* Dispatch action footer — only for unresolved, not yet dispatched */}
              {isUnresolved && !isDispatched && (
                isPending ? (
                  // Confirmation step
                  <div className="px-4 py-3 border-t border-amber-500/20 bg-amber-950/30 space-y-2">
                    <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                      <Info className="w-3.5 h-3.5" />Review workflow before authorizing
                    </p>
                    {cr.workflowPlan && (
                      <div className="space-y-1">
                        {[
                          { k: 'action',     v: cr.workflowPlan.action },
                          { k: 'recipient',  v: cr.workflowPlan.recipient },
                          { k: 'channel',    v: cr.workflowPlan.channel },
                          { k: 'turnaround', v: cr.workflowPlan.turnaround },
                        ].map(({ k, v }) => (
                          <div key={k} className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-20 shrink-0">{k}</span>
                            <span className="text-slate-200">{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1 border-t border-amber-500/10">
                      <button onClick={() => cancelPending(cr.rule.label)}
                        className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => confirmDispatch(cr.rule.label)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />Confirm &amp; Dispatch
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 border-t border-amber-500/20 flex justify-end">
                    <button onClick={() => stagePending(cr.rule.label)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors">
                      <Zap className="w-3.5 h-3.5" />Dispatch Workflow
                    </button>
                  </div>
                )
              )}
            </div>
          )
        })}
      </div>

      {needsReview > 0 && (
        <div className="mt-3 bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              {dispatchedCount > 0 && dispatchedCount < needsReview
                ? `${dispatchedCount} of ${needsReview} workflows dispatched`
                : dispatchedCount === needsReview
                  ? 'All workflows dispatched — launch when ready'
                  : 'Resolution required'}
            </p>
            <p className="text-sm text-amber-200/70 mt-0.5">
              {dispatchedCount === needsReview
                ? 'Agents are gathering missing documentation. You can launch now or wait for results.'
                : 'Dispatch resolution workflows above, or launch to flag this case as an exception in your portfolio.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function IntakeView({ preloadedScenarioId, onLaunch }: {
  preloadedScenarioId: string | null
  onLaunch: (scenario: ScenarioConfig) => void
}) {
  const [phase, setPhase] = useState<IntakePhase>(preloadedScenarioId ? 'extracted' : 'upload')
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(
    preloadedScenarioId ? (scenarios[preloadedScenarioId] ?? null) : null
  )
  const [clientType, setClientType] = useState<ClientType>('patient')
  const [clientId, setClientId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]; if (f) setFile(f)
  }

  const handleAnalyze = () => {
    setPhase('analyzing')
    let i = 0
    const iv = setInterval(() => {
      i++; setStepIdx(i)
      if (i >= analyzeSteps.length - 1) {
        clearInterval(iv)
        setTimeout(() => { setActiveScenario(scenarios['ph-2847']); setPhase('extracted') }, 400)
      }
    }, 750)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div id="tour-intake-header" className="px-8 py-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">
          {preloadedScenarioId ? 'Case Detail' : 'New Case Intake'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {preloadedScenarioId
            ? 'Configuration pre-loaded from client record. Review criteria and launch the pipeline.'
            : 'Upload patient chart and denial documentation. The system extracts drug, plan, and criteria automatically.'}
        </p>
      </div>

      <div className="p-8 max-w-3xl space-y-5">
        {(phase === 'upload' || phase === 'analyzing') && (
          <>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Who is this case for?</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['patient', 'medtech'] as ClientType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setClientType(t)}
                      disabled={phase === 'analyzing'}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        clientType === t
                          ? t === 'patient' ? 'bg-violet-500/10 border-violet-500/40 text-violet-300' : 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                          : 'bg-slate-700/40 border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {t === 'patient' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      {t === 'patient' ? 'Patient Appeal' : 'MedTech Partner'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {clientType === 'patient'
                    ? 'Patient contacting Paxos Health for help with a prior authorization denial.'
                    : 'Pharma or biotech company onboarding a drug onto the PA workflow platform.'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {clientType === 'patient' ? 'Patient / Case Identifier' : 'Company Name'}
                </label>
                <input
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  disabled={phase === 'analyzing'}
                  placeholder={clientType === 'patient' ? 'e.g. Case #PH-3821 (auto-assigned if blank)' : 'e.g. Intercept Pharmaceuticals'}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Upload Documents</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => phase === 'upload' && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors ${
                  phase === 'analyzing' ? 'border-slate-700 bg-slate-800/20 opacity-60 cursor-default'
                  : dragging ? 'border-blue-500 bg-blue-500/5 cursor-pointer'
                  : file ? 'border-emerald-500/50 bg-emerald-500/5 cursor-pointer'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/20 cursor-pointer'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
                {file ? (
                  <><FileText className="w-9 h-9 text-emerald-400 mb-2" />
                    <p className="text-sm font-medium text-emerald-300">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to replace</p></>
                ) : (
                  <><Upload className="w-9 h-9 text-slate-500 mb-2" />
                    <p className="text-sm font-medium text-slate-300">Drop patient chart or denial letter here</p>
                    <p className="text-xs text-slate-500 mt-1">PDF · Click to browse</p></>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                The system extracts the drug name, insurance plan, denial reason, and relevant criteria. No manual entry required.
              </p>
            </div>

            {phase === 'upload' && (
              <button onClick={handleAnalyze}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                <Zap className="w-4 h-4" />Analyze Documents
              </button>
            )}

            {phase === 'analyzing' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-950/50 border border-blue-500/20 rounded-lg">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  <span className="text-sm text-blue-300">{analyzeSteps[stepIdx]}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className="bg-blue-500 h-1 rounded-full transition-all duration-700"
                    style={{ width: `${((stepIdx + 1) / analyzeSteps.length) * 100}%` }} />
                </div>
                <p className="text-xs text-slate-500 text-center">Running extraction pipeline · Do not close this window</p>
              </div>
            )}
          </>
        )}

        {phase === 'extracted' && activeScenario && (
          <>
            <ConfigBanner scenario={activeScenario} />
            <ExtractedFieldsGrid scenario={activeScenario} />
            <CriteriaPrecheck scenario={activeScenario} />
            {(() => {
              const gaps = activeScenario.criteriaResults.filter(r => r.status === 'needs_review').length
              return (
                <button
                  id="tour-launch-btn"
                  onClick={() => onLaunch(activeScenario)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    gaps > 0
                      ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  {gaps > 0
                    ? `Launch Pipeline · ${gaps} gap${gaps !== 1 ? 's' : ''} will be flagged`
                    : 'Launch Full Pipeline'}
                </button>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline step definitions (label + plain-English explanation)
// ---------------------------------------------------------------------------

interface PipelineStep {
  label: string
  loadingText: string
  explanation: string
}

function getPipelineSteps(scenario: ScenarioConfig): PipelineStep[] {
  const isInfant = scenario.id === 'infant-omeprazole'
  return [
    {
      label: 'Ingestion',
      loadingText: isInfant
        ? 'Parsing UHC denial for omeprazole suspension...'
        : `Parsing ${scenario.plan} denial for ${scenario.drug}...`,
      explanation: isInfant
        ? `Parsed the UnitedHealthcare denial for omeprazole oral suspension. Identified the denial as a formulary exception request — the payer requires step therapy with a tablet or H2 blocker before approving a compounded liquid. Extracted patient age (4 months), diagnosis (infantile GERD, K21.0), and the formulary alternative the payer cited.`
        : `Parsed the ${scenario.plan} denial for ${scenario.drug} (semaglutide). Identified the denial as a step therapy requirement: the payer claims insufficient documentation that the patient trialed Metformin before escalating to a GLP-1 agonist. Extracted drug, diagnosis (T2DM, E11.9), and the four PA criteria to satisfy.`,
    },
    {
      label: 'Retrieval',
      loadingText: isInfant
        ? 'Loading pediatric GI policy + FDA safety database...'
        : `Loading ${scenario.plan} PA policy for GLP-1 agonists...`,
      explanation: isInfant
        ? `Loaded UHC's pediatric GI formulary criteria. Critically, also retrieved the FDA's April 2020 ranitidine (Zantac) market withdrawal notice — establishing that the payer's preferred H2 blocker alternative is no longer legally available in the US due to NDMA contamination. The step therapy path the payer requires does not exist.`
        : `Loaded ${scenario.plan}'s PA policy for GLP-1 agonists. Retrieved 4 criteria to satisfy: confirmed T2DM diagnosis, HbA1c ≥ 7.5% on current regimen, ≥ 90 days of Metformin at maximum tolerated dose, and no history of medullary thyroid carcinoma. Cross-referenced each against the patient's submitted records.`,
    },
    {
      label: 'Synthesis',
      loadingText: 'Drafting evidence-grounded appeal letter...',
      explanation: isInfant
        ? `Generated an appeal making two independent arguments that can't be simultaneously refuted: (1) the patient is 4 months old — solid tablet formulations are physically impossible to administer; (2) the formulary H2 alternative (ranitidine) was withdrawn by the FDA due to NDMA contamination and cannot be trialed. Cited NASPGHAN 2018 pediatric GERD guidelines (PMID 29470322) for dosing standards.`
        : `Generated an appeal letter grounded in all 4 PA criteria. Confirmed T2DM via endocrinology consult (HbA1c 8.2%, threshold 7.5%). Documented 112 consecutive days of Metformin 1000mg BID from pharmacy fill records — exceeding the 90-day threshold. Safety check clear. Every claim traces to a source document; no unsupported assertions.`,
    },
    {
      label: 'Gatekeeper',
      loadingText: 'Running deterministic validation (no LLM)...',
      explanation: isInfant
        ? `Ran 5 deterministic checks without any AI model: drug name present, infant age documented, FDA recall referenced, NASPGHAN PMID cited, letter length adequate. All passed. The appeal is ready for the Authorization Manager's review — a human is the final authority before anything is transmitted to the payer.`
        : `Ran 5 deterministic checks without AI: drug name present, diagnosis referenced, step therapy denial addressed, all 4 criteria cited, minimum letter length met. All passed. The appeal has been handed to the AM for final human review and authorization before submission to ${scenario.plan}.`,
    },
  ]
}

// ---------------------------------------------------------------------------
// View 3 — Pipeline Execution
// ---------------------------------------------------------------------------

function POCView({ scenario, onReset, onSaveToPortfolio, reviewMode, autoStart, caseStatus }: {
  scenario: ScenarioConfig
  onReset: () => void
  onSaveToPortfolio?: () => void
  reviewMode?: boolean
  autoStart?: boolean
  caseStatus?: CaseStatus
}) {
  const [phase, setPhase] = useState<SimPhase>(
    reviewMode && (caseStatus === 'submitted' || caseStatus === 'payer_response') ? 'submitted' :
    reviewMode ? 'done' :
    'idle'
  )
  const [dispatched, setDispatched] = useState<string[]>([])
  const [pendingDispatch, setPendingDispatch] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [appealRef] = useState(() => `PH-${Math.floor(Math.random() * 9000) + 1000}`)
  const [traceOpen, setTraceOpen] = useState(true)
  const [hoveredCite, setHoveredCite] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedBody, setEditedBody] = useState<string | null>(null)
  const [round2StepIdx, setRound2StepIdx] = useState(0)
  const [tourIdx, setTourIdx] = useState(0)
  const [round2TourIdx, setRound2TourIdx] = useState(0)

  const letterDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const generateLetterBody = (): string => {
    const evidenceLines = scenario.criteriaResults.map((cr, i) => {
      const cite = scenario.citations[cr.rule.label]
      return [
        `${i + 1}. ${cr.rule.label}`,
        cite ? `   ${cite.source} · ${cite.page}` : '',
        `   "${cite ? cite.text : 'Supporting documentation confirmed.'}"`,
      ].filter(Boolean).join('\n')
    }).join('\n\n')
    return `Dear Medical Director,\n\nWe are writing to formally appeal the prior authorization denial for ${scenario.drug}. The denial cited "${scenario.denialReason}." Upon thorough review of the patient's clinical record, we submit that all applicable criteria for ${scenario.diagnosis} have been satisfied, as documented below.\n\nCLINICAL EVIDENCE — ${scenario.configFile}\n\n${evidenceLines}\n\nBased on the documented clinical evidence, we respectfully request that the prior authorization for ${scenario.drug} be approved. This medication is medically necessary for the management of ${scenario.diagnosis} and consistent with current clinical guidelines.\n\nSincerely,\nPaxos Health\nAI-Assisted Prior Authorization Team`
  }
  const pipelineSteps = getPipelineSteps(scenario)

  const handleRound2Execute = () => {
    setPhase('round2_loading'); setRound2StepIdx(0); setRound2TourIdx(0)
    let i = 0
    const iv = setInterval(() => {
      i++; setRound2StepIdx(i)
      if (i >= pipelineSteps.length - 1) { clearInterval(iv) }
    }, 2500)
  }

  const [overrides, setOverrides] = useState<Record<string, string>>({}) // ruleLabel -> AM rationale
  const [pendingOverride, setPendingOverride] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState('')

  const unresolvedCriteria = scenario.criteriaResults.filter(cr => cr.status === 'needs_review')
  const satisfiedCriteria = scenario.criteriaResults.filter(cr => cr.status === 'found')
  const hasExceptions = unresolvedCriteria.length > 0
  const allResolved = unresolvedCriteria.length > 0 &&
    unresolvedCriteria.every(cr => dispatched.includes(cr.rule.label) || overrides[cr.rule.label])

  const dispatchWorkflow = (ruleLabel: string) => setDispatched(prev => [...prev, ruleLabel])
  const stagePendingDispatch = (ruleLabel: string) => setPendingDispatch(prev => [...prev, ruleLabel])
  const cancelPendingDispatch = (ruleLabel: string) => setPendingDispatch(prev => prev.filter(l => l !== ruleLabel))
  const confirmDispatch = (ruleLabel: string) => {
    dispatchWorkflow(ruleLabel)
    cancelPendingDispatch(ruleLabel)
  }
  const dispatchAll = () => {
    const remaining = unresolvedCriteria
      .filter(cr => !dispatched.includes(cr.rule.label) && !overrides[cr.rule.label])
    setPendingDispatch(prev => [...new Set([...prev, ...remaining.map(cr => cr.rule.label)])])
  }
  const applyOverride = (ruleLabel: string) => {
    if (!overrideInput.trim()) return
    setOverrides(prev => ({ ...prev, [ruleLabel]: overrideInput.trim() }))
    setPendingOverride(null)
    setOverrideInput('')
  }
  const [stepIdx, setStepIdx] = useState(0)

  const handleExecute = () => {
    setPhase('loading'); setStepIdx(0); setTourIdx(0)
    let i = 0
    const iv = setInterval(() => {
      i++; setStepIdx(i)
      if (i >= pipelineSteps.length - 1) { clearInterval(iv) }
    }, 2500)
  }

  useEffect(() => {
    setTourIdx(prev => prev === stepIdx - 1 ? stepIdx : prev)
  }, [stepIdx])

  useEffect(() => {
    setRound2TourIdx(prev => prev === round2StepIdx - 1 ? round2StepIdx : prev)
  }, [round2StepIdx])

  useEffect(() => {
    if (autoStart) handleExecute()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const evidenceRows = scenario.criteriaResults.map((cr, i) => {
      const cite = scenario.citations[cr.rule.label]
      return `
      <div class="criterion">
        <strong>Criterion ${i + 1}: ${cr.rule.label}</strong><br/>
        ${cite ? `<span class="citation-meta">${cite.source} &middot; ${cite.page}</span><br/>` : ''}
        <span class="citation">"${cite ? cite.text : 'Supporting documentation confirmed.'}"</span>
      </div>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><title>PA Appeal — ${scenario.drug}</title>
      <style>
        body{font-family:Georgia,serif;max-width:720px;margin:60px auto;color:#111;line-height:1.7;font-size:15px}
        h1{font-size:20px;margin-bottom:6px}
        .meta{color:#555;font-size:13px;border-bottom:1px solid #ddd;padding-bottom:16px;margin-bottom:28px}
        p{margin:0 0 14px}
        .section-title{font-weight:bold;margin:24px 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#444}
        .criterion{margin-bottom:14px;padding-left:18px;border-left:3px solid #ddd}
        .citation-meta{color:#777;font-size:12px;font-weight:500}
        .citation{color:#555;font-style:italic;font-size:13px}
        .footer{margin-top:52px;border-top:1px solid #ddd;padding-top:14px;font-size:12px;color:#999}
      </style></head><body>
      <h1>Prior Authorization Appeal Letter</h1>
      <div class="meta">Generated by Paxos Health Universal Medical Ontology Platform &middot; ${date}</div>
      <p><strong>RE: Appeal of Prior Authorization Denial — ${scenario.drug}</strong></p>
      <p>Insurance Plan: <strong>${scenario.plan}</strong> (Plan ID: ${scenario.planId})<br/>
         Denial Reason on File: ${scenario.denialReason}</p>
      <p>Dear Medical Director,</p>
      <p>We are writing to formally appeal the prior authorization denial for <strong>${scenario.drug}</strong>.
         The denial cited &ldquo;${scenario.denialReason}.&rdquo;
         Upon thorough clinical record review, we submit that all applicable criteria for
         <strong>${scenario.diagnosis}</strong> have been satisfied, as documented below.</p>
      <div class="section-title">Clinical Evidence — ${scenario.configFile}</div>
      ${evidenceRows}
      <p>Based on the documented evidence, we respectfully request that the prior authorization for
         <strong>${scenario.drug}</strong> be approved. This medication is medically necessary for
         the management of <strong>${scenario.diagnosis}</strong> and consistent with current clinical guidelines.</p>
      <p>Sincerely,<br/><strong>Paxos Health</strong><br/>AI-Assisted Prior Authorization Team</p>
      <div class="footer">
        Generated via Universal Medical Ontology Pipeline · Config: ${scenario.configFile} ·
        All citations extracted directly from submitted medical records.
      </div></body></html>`

    const printable = html.replace('</body>', '<script>window.onload=()=>window.print()</scr' + 'ipt></body>')
    const blob = new Blob([printable], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  return (
    <div className="flex-1 overflow-auto">
      <div id="tour-pipeline-header" className="px-8 py-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">
          {phase === 'review'    ? 'Review Appeal Letter'
           : phase === 'submitted' ? 'Appeal Submitted'
           : 'Pipeline Execution'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {phase === 'review'
            ? 'Read carefully before authorizing submission — this document will be transmitted to the payer'
            : phase === 'submitted'
              ? <span className="text-emerald-400">Transmitted to {scenario.plan}</span>
              : <>4-node DAG · Config: <span className="font-mono text-blue-400">{scenario.configFile}</span></>}
        </p>
      </div>

      <div className={`p-8 space-y-5 ${phase === 'review' || phase === 'round2_done' ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="flex items-center gap-4 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl text-sm">
          <Package className="w-5 h-5 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-white font-medium">{scenario.drug}</span>
            <span className="text-slate-500 mx-2">·</span>
            <span className="text-slate-400">{scenario.plan}</span>
          </div>
          <span className="text-xs text-slate-500">{scenario.criteriaResults.length} rules loaded</span>
        </div>

        {phase === 'review' ? (
          // ── Letter Review ─────────────────────────────────────────────────
          <div className="space-y-5">
            {/* Two-column layout: letter left, citations right */}
            <div className="flex gap-6 items-start">
              {/* Left col: info bar + letter */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
                  <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">Review before authorizing submission</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {editMode
                        ? 'Editing — changes save when you click Done editing'
                        : 'Read carefully. You may edit the letter before acknowledging.'}
                    </p>
                  </div>
                </div>

                {/* Letter document — white paper card */}
                <div className="bg-white rounded-xl overflow-hidden shadow-xl">
                  {/* Toolbar */}
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-4">
                    <span className="text-xs font-mono text-slate-400 truncate">
                      Generated by Paxos Health · {letterDate}
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      {!editMode && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          DRAFT — PENDING AUTHORIZATION
                        </span>
                      )}
                      <button
                        onClick={() => {
                          if (editMode) {
                            setEditMode(false)
                          } else {
                            setEditedBody(prev => prev ?? generateLetterBody())
                            setEditMode(true)
                            setAcknowledged(false)
                          }
                        }}
                        className="text-xs flex items-center gap-1 transition-colors text-blue-500 hover:text-blue-700"
                      >
                        {editMode
                          ? <><CheckCircle className="w-3 h-3" />Done editing</>
                          : <><Pencil className="w-3 h-3" />Edit letter</>}
                      </button>
                      {!editMode && (
                        <button onClick={handleDownload}
                          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                          <Download className="w-3 h-3" />Save copy
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Letter body */}
                  <div className="px-12 py-10 text-slate-900 text-sm leading-relaxed space-y-5">
                    <h1 className="text-base font-bold">Prior Authorization Appeal Letter</h1>

                    {/* Fixed meta — always from data */}
                    <div className="text-xs text-slate-600 border-b border-slate-200 pb-4 space-y-1">
                      <p><strong>RE:</strong> Appeal of Prior Authorization Denial — {scenario.drug}</p>
                      <p><strong>To:</strong> Medical Director, {scenario.plan}&nbsp;(Plan ID: {scenario.planId})</p>
                      <p><strong>Denial on file:</strong> {scenario.denialReason}</p>
                    </div>

                    {/* Editable body — three modes */}
                    {editMode ? (
                      <textarea
                        value={editedBody ?? ''}
                        onChange={e => setEditedBody(e.target.value)}
                        className="w-full min-h-96 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm leading-relaxed resize-y focus:outline-none focus:border-blue-400"
                      />
                    ) : editedBody ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
                        {editedBody}
                      </div>
                    ) : (
                      <>
                        <p>Dear Medical Director,</p>
                        <p>
                          We are writing to formally appeal the prior authorization denial for{' '}
                          <strong>{scenario.drug}</strong>. The denial cited &ldquo;{scenario.denialReason}.&rdquo; Upon
                          thorough review of the patient&rsquo;s clinical record, we submit that all applicable
                          criteria for <strong>{scenario.diagnosis}</strong> have been satisfied, as documented below.
                        </p>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                            Clinical Evidence — {scenario.configFile}
                          </p>
                          <div className="space-y-4">
                            {scenario.criteriaResults.map((cr, i) => {
                              const cite = scenario.citations[cr.rule.label]
                              const active = hoveredCite === i
                              return (
                                <div
                                  key={i}
                                  onMouseEnter={() => setHoveredCite(i)}
                                  onMouseLeave={() => setHoveredCite(null)}
                                  className={`pl-3 border-l-2 rounded-sm pr-2 py-1 transition-colors cursor-default ${
                                    active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'
                                  }`}
                                >
                                  <p className="text-xs font-bold text-slate-700">{i + 1}. {cr.rule.label}</p>
                                  {cite && <p className="text-xs text-slate-400 mt-0.5">{cite.source} · {cite.page}</p>}
                                  <p className="text-xs italic text-slate-600 mt-1">
                                    &ldquo;{cite ? cite.text : 'Supporting documentation confirmed.'}&rdquo;
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <p>
                          Based on the documented clinical evidence, we respectfully request that the prior
                          authorization for <strong>{scenario.drug}</strong> be approved. This medication is
                          medically necessary for the management of <strong>{scenario.diagnosis}</strong> and
                          consistent with current clinical guidelines.
                        </p>
                        <div>
                          <p>Sincerely,</p>
                          <p className="font-bold mt-2">Paxos Health</p>
                          <p className="text-slate-500 text-xs">AI-Assisted Prior Authorization Team</p>
                        </div>
                      </>
                    )}

                    {/* Fixed footer — always from data */}
                    <div className="text-xs text-slate-400 border-t border-slate-200 pt-4">
                      Generated via Universal Medical Ontology Pipeline · Config: {scenario.configFile} ·
                      All citations extracted directly from submitted medical records.
                    </div>
                  </div>
                </div>
              </div>

              {/* Right col: citation ground truth panel */}
              <div className="w-72 shrink-0 sticky top-4">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-800/60">
                    <div className="flex items-center gap-2 mb-0.5">
                      <BookmarkPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                      <p className="text-sm font-semibold text-slate-200">Citation Ground Truth</p>
                    </div>
                    <p className="text-xs text-slate-500">Every claim maps to a source document</p>
                  </div>
                  <div className="divide-y divide-slate-700/40">
                    {scenario.criteriaResults.map((cr, i) => {
                      const cite = scenario.citations[cr.rule.label]
                      const active = hoveredCite === i
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredCite(i)}
                          onMouseLeave={() => setHoveredCite(null)}
                          className={`px-4 py-3 transition-colors cursor-default ${active ? 'bg-emerald-950/50' : ''}`}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <span className={`text-xs font-bold mt-0.5 shrink-0 transition-colors ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{i + 1}</span>
                            <p className={`text-xs font-medium leading-snug transition-colors ${active ? 'text-white' : 'text-slate-300'}`}>{cr.rule.label}</p>
                          </div>
                          {cite ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <FileText className="w-3 h-3 shrink-0" />
                                <span>{cite.source}</span>
                                <span className="text-slate-700">·</span>
                                <span>{cite.page}</span>
                              </div>
                              <p className={`text-xs italic text-emerald-300/80 rounded px-2.5 py-1.5 leading-relaxed transition-all ${
                                active ? 'bg-emerald-950/80 border border-emerald-400/50' : 'bg-emerald-950/40 border border-emerald-500/20'
                              }`}>
                                &ldquo;{cite.text}&rdquo;
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 italic pl-4">Supporting documentation confirmed</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Acknowledgment gate — full width below two-column area */}
            <div className={`bg-slate-800/40 border rounded-xl p-4 transition-opacity ${editMode ? 'opacity-40 pointer-events-none' : 'border-slate-700'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={e => setAcknowledged(e.target.checked)}
                  disabled={editMode}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0"
                />
                <span className="text-sm text-slate-300 leading-relaxed">
                  I have reviewed this appeal letter and confirm it accurately represents the
                  patient&rsquo;s clinical record and satisfies the prior authorization criteria
                  documented above.
                </span>
              </label>
            </div>
            {editMode && (
              <p className="text-xs text-center text-amber-400">Click &ldquo;Done editing&rdquo; above before acknowledging</p>
            )}

            <div className="flex gap-3 pt-1 flex-wrap">
              <button
                onClick={() => setPhase('submitted')}
                disabled={!acknowledged || editMode}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />Confirm &amp; Submit Appeal
              </button>
              <button onClick={() => { setPhase('done'); setAcknowledged(false); setEditMode(false) }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                ← Back
              </button>
            </div>
          </div>

        ) : phase === 'submitted' ? (
          // ── Submitted ────────────────────────────────────────────────────
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-400">Appeal Submitted</h2>
                <p className="text-sm text-emerald-300/70">
                  Transmitted to {scenario.plan} · {appealRef}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-1.5">
              {([
                { k: 'drug',          v: scenario.drug },
                { k: 'plan',          v: `${scenario.plan} (${scenario.planId})` },
                { k: 'diagnosis',     v: scenario.diagnosis },
                { k: 'reference',     v: appealRef },
                { k: 'submitted_by',  v: 'Account Manager · Paxos Health Portal' },
                { k: 'timestamp',     v: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
              ] as const).map(({ k, v }) => (
                <div key={k} className="flex items-start gap-3 text-xs font-mono">
                  <span className="text-slate-600 w-28 shrink-0">{k}</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>

            {scenario.payerCounterOffer && (
              <div id="tour-payer-response" className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-violet-950/40 border border-violet-500/30 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-violet-300">Payer Response Received · {scenario.payerCounterOffer.date}</p>
                    <p className="text-xs text-violet-300/70 mt-0.5">{scenario.payerCounterOffer.summary}</p>
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-1.5">
                  {([
                    { k: 'approved_dose',    v: scenario.payerCounterOffer.approvedDose },
                    { k: 'new_denial_basis', v: scenario.payerCounterOffer.newDenialReason },
                    { k: 'guideline_ref',    v: scenario.round2Appeal?.guidelineRef ?? '' },
                    { k: 'pmid',             v: scenario.round2Appeal?.guidelinePMID ? `https://pubmed.ncbi.nlm.nih.gov/${scenario.round2Appeal.guidelinePMID}` : '' },
                  ] as const).filter(({ v }) => v).map(({ k, v }) => (
                    <div key={k} className="flex items-start gap-3 text-xs font-mono">
                      <span className="text-slate-600 w-28 shrink-0">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
                <button id="tour-round2-execute" onClick={handleRound2Execute}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <Zap className="w-4 h-4" />Generate Round 2 Counter-Argument
                </button>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                <ChevronRight className="w-4 h-4" />Return to Portfolio
              </button>
            </div>
          </div>

        ) : phase === 'round2_loading' ? (
          // ── Round 2 Loading ──────────────────────────────────────────────
          (() => {
            const stepIcons = [FileText, Search, GitBranch, Shield]
            const TourIcon = stepIcons[round2TourIdx]
            const tourStepDone = round2TourIdx < round2StepIdx
            return (
              <div className="space-y-4">
                {/* Horizontal stepper — violet scheme */}
                <div className="grid grid-cols-4">
                  {pipelineSteps.map((step, i) => {
                    const isComplete = i < round2StepIdx
                    const isCurrent = i === round2StepIdx
                    const StepIcon = stepIcons[i]
                    return (
                      <div
                        key={i}
                        className="relative flex flex-col items-center cursor-pointer group"
                        onClick={() => i <= round2StepIdx && setRound2TourIdx(i)}
                      >
                        {i < pipelineSteps.length - 1 && (
                          <div className={`absolute top-5 left-1/2 w-full h-px z-0 transition-colors duration-700 ${
                            isComplete ? 'bg-violet-500' : 'bg-slate-700'
                          }`} />
                        )}
                        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                          isComplete ? 'bg-violet-500/20 border-violet-500' :
                          isCurrent ? 'bg-violet-500/10 border-violet-400' :
                          'bg-slate-800 border-slate-700'
                        } ${round2TourIdx === i && i <= round2StepIdx ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white/20' : ''}`}>
                          {isComplete
                            ? <CheckCircle className="w-5 h-5 text-violet-400" />
                            : isCurrent
                            ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                            : <StepIcon className="w-5 h-5 text-slate-600" />}
                        </div>
                        <span className={`text-xs font-medium mt-1.5 text-center leading-tight ${
                          isComplete ? 'text-violet-400' :
                          isCurrent ? 'text-violet-300' :
                          'text-slate-600'
                        } ${i <= round2StepIdx ? 'group-hover:brightness-125' : ''}`}>{step.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Tour card — violet */}
                <div className="bg-slate-800/70 border border-violet-800/60 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-violet-800/40 bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                      <TourIcon className={`w-4 h-4 ${tourStepDone ? 'text-violet-400' : 'text-violet-400'}`} />
                      <span className="text-sm font-semibold text-white">{pipelineSteps[round2TourIdx].label}</span>
                      {tourStepDone && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium">Complete</span>}
                    </div>
                    <span className="text-xs text-slate-500">Step {round2TourIdx + 1} of {pipelineSteps.length}</span>
                  </div>
                  <div className="px-4 py-4 min-h-[80px]">
                    {tourStepDone ? (
                      <p className="text-sm text-slate-300 leading-relaxed">{pipelineSteps[round2TourIdx].explanation}</p>
                    ) : (
                      <div className="flex items-start gap-2.5">
                        <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0 mt-0.5" />
                        <p className="text-sm text-violet-300">{pipelineSteps[round2TourIdx].loadingText}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-violet-800/30 bg-slate-900/30">
                    <button
                      onClick={() => setRound2TourIdx(prev => Math.max(0, prev - 1))}
                      disabled={round2TourIdx === 0}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />Previous
                    </button>
                    <div className="flex gap-1.5">
                      {pipelineSteps.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                          round2TourIdx === i ? 'bg-violet-400' : i < round2StepIdx ? 'bg-violet-700' : i === round2StepIdx ? 'bg-violet-900' : 'bg-slate-700'
                        }`} />
                      ))}
                    </div>
                    <button
                      onClick={() => setRound2TourIdx(prev => Math.min(round2StepIdx, prev + 1))}
                      disabled={round2TourIdx >= round2StepIdx}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                    >
                      Next<ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {round2StepIdx === pipelineSteps.length - 1 ? (
                  <button
                    onClick={() => setPhase('round2_done')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />Continue to Counter-Argument
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Round 2 · Counter-argument pipeline · {scenario.configFile}</p>
                )}
              </div>
            )
          })()

        ) : phase === 'round2_done' ? (
          // ── Round 2 Letter ───────────────────────────────────────────────
          <div className="space-y-4">
            <div className="flex gap-6 items-start">
              {/* Left col: header + letter */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center gap-4 p-4 bg-violet-950/40 border border-violet-500/30 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-violet-300">Round 2 Counter-Argument Ready</h2>
                    <p className="text-xs text-violet-300/70">Dose threshold · NASPGHAN 2018 · PMID {scenario.round2Appeal?.guidelinePMID}</p>
                  </div>
                </div>
                {/* Round 2 letter — structured sections so each maps to a citation */}
                {scenario.round2Appeal && scenario.payerCounterOffer && (() => {
                  const r2 = scenario.round2Appeal!
                  const offer = scenario.payerCounterOffer!
                  const sectionCls = (idx: number) =>
                    `p-3 rounded-lg border transition-colors cursor-default ${
                      hoveredCite === idx
                        ? 'bg-violet-900/40 border-violet-500/50'
                        : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-700/40'
                    }`
                  return (
                    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 font-mono text-xs text-slate-300 space-y-1 leading-relaxed">
                      <p>Dear Medical Director,</p>
                      <p className="pb-2">Thank you for your partial authorization dated <span className="text-slate-200">{offer.date}</span> for <span className="text-slate-200">{scenario.drug}</span>. We write to formally contest the approved dose limitation of <span className="text-amber-300">{offer.approvedDose}</span>.</p>

                      <div
                        onMouseEnter={() => setHoveredCite(0)}
                        onMouseLeave={() => setHoveredCite(null)}
                        className={sectionCls(0)}
                      >
                        <p className="font-bold text-slate-200 mb-1">CLINICAL BASIS FOR DOSE INCREASE</p>
                        <p>{r2.keyArgument}</p>
                      </div>

                      <div
                        onMouseEnter={() => setHoveredCite(1)}
                        onMouseLeave={() => setHoveredCite(null)}
                        className={sectionCls(1)}
                      >
                        <p className="font-bold text-slate-200 mb-1">SUPPORTING GUIDELINE</p>
                        <p>{r2.guidelineRef}</p>
                        <p className="text-slate-400">PubMed PMID: {r2.guidelinePMID}</p>
                      </div>

                      <div
                        onMouseEnter={() => setHoveredCite(2)}
                        onMouseLeave={() => setHoveredCite(null)}
                        className={sectionCls(2)}
                      >
                        <p className="font-bold text-slate-200 mb-1">REQUESTED AUTHORIZATION</p>
                        <p>We respectfully request authorization be revised to <span className="text-emerald-300">{r2.requiredDose}</span> for {scenario.diagnosis}. Approval at the sub-therapeutic dose previously authorized does not meet the evidence-based standard of care and places the patient at continued clinical risk.</p>
                      </div>

                      <div className="pt-2">
                        <p>We are prepared to provide any additional clinical documentation upon request and appreciate your prompt reconsideration.</p>
                        <p className="pt-2">Sincerely,<br />Paxos Health<br /><span className="text-slate-500">AI-Assisted Prior Authorization Team</span></p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Right col: citation panel */}
              {scenario.round2Appeal && (
                <div className="w-72 shrink-0 sticky top-4">
                  <div className="bg-slate-800/40 border border-violet-700/40 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-violet-700/40 bg-violet-950/30">
                      <div className="flex items-center gap-2 mb-0.5">
                        <BookmarkPlus className="w-4 h-4 text-violet-400 shrink-0" />
                        <p className="text-sm font-semibold text-slate-200">Citation Ground Truth</p>
                      </div>
                      <p className="text-xs text-slate-500">Sources cited in this counter-argument</p>
                    </div>
                    <div className="divide-y divide-slate-700/40">
                      {[
                        {
                          idx: 0,
                          label: 'Clinical Guideline',
                          title: scenario.round2Appeal.guidelineRef,
                          meta: `PubMed PMID: ${scenario.round2Appeal.guidelinePMID}`,
                          quote: `Therapeutic dose for infantile GERD: ${scenario.round2Appeal.requiredDose} — below which clinical response is sub-therapeutic.`,
                        },
                        {
                          idx: 1,
                          label: 'FDA Safety Communication',
                          title: 'Ranitidine (Zantac) Market Withdrawal — NDMA Contamination',
                          meta: 'FDA · April 2020',
                          quote: 'All ranitidine products withdrawn from US market due to unacceptable NDMA levels — H2 blocker alternative unavailable.',
                        },
                        {
                          idx: 2,
                          label: 'Payer Counter-Offer on File',
                          title: `Approved ${scenario.payerCounterOffer?.approvedDose} → requested ${scenario.round2Appeal.requiredDose}`,
                          meta: `Counter-offer dated ${scenario.payerCounterOffer?.date}`,
                          quote: scenario.round2Appeal.keyArgument,
                        },
                      ].map(({ idx, label, title, meta, quote }) => {
                        const active = hoveredCite === idx
                        return (
                          <div
                            key={idx}
                            onMouseEnter={() => setHoveredCite(idx)}
                            onMouseLeave={() => setHoveredCite(null)}
                            className={`px-4 py-3 space-y-1.5 transition-colors cursor-default ${active ? 'bg-violet-950/50' : ''}`}
                          >
                            <p className={`text-xs font-semibold transition-colors ${active ? 'text-violet-200' : 'text-violet-300'}`}>{label}</p>
                            <p className={`text-xs font-medium leading-snug transition-colors ${active ? 'text-white' : 'text-slate-300'}`}>{title}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <FileText className="w-3 h-3 shrink-0" />
                              <span>{meta}</span>
                            </div>
                            <p className={`text-xs italic text-violet-300/80 rounded px-2.5 py-1.5 leading-relaxed transition-all ${
                              active ? 'bg-violet-950/80 border border-violet-400/50' : 'bg-violet-950/40 border border-violet-500/20'
                            }`}>
                              {quote}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setPhase('round2_submitted')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
                <CheckCircle className="w-4 h-4" />Submit Round 2 Counter
              </button>
              <button onClick={onReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                <RotateCcw className="w-4 h-4" />Reset
              </button>
            </div>
          </div>

        ) : phase === 'round2_submitted' ? (
          // ── Round 2 Submitted ────────────────────────────────────────────
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-5 bg-violet-950/40 border border-violet-500/30 rounded-xl">
              <div className="w-11 h-11 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-violet-300">Round 2 Counter Submitted</h2>
                <p className="text-sm text-violet-300/70">Transmitted to {scenario.plan} · {appealRef}</p>
              </div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Clinical basis cited</p>
              <p className="text-sm text-slate-300">{scenario.round2Appeal?.guidelineRef}</p>
              <p className="text-xs text-slate-500 mt-1">PMID: {scenario.round2Appeal?.guidelinePMID} · Required dose: {scenario.round2Appeal?.requiredDose}</p>
            </div>
            <button onClick={onReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
              <ChevronRight className="w-4 h-4" />Return to Portfolio
            </button>
          </div>

        ) : phase === 'done' && hasExceptions ? (
          // ── Exception Review ─────────────────────────────────────────────
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-4 p-5 bg-amber-950/40 border border-amber-500/30 rounded-xl">
              <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-400">Exception Report</h2>
                <p className="text-sm text-amber-300/70">
                  {unresolvedCriteria.length} unresolved {unresolvedCriteria.length === 1 ? 'gap' : 'gaps'} · {satisfiedCriteria.length} criteria auto-confirmed by AI
                </p>
              </div>
            </div>

            {/* AI-confirmed criteria (collapsed) */}
            <details className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300 select-none">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Confirmed by AI — {satisfiedCriteria.length} {satisfiedCriteria.length === 1 ? 'criterion' : 'criteria'}</span>
              </summary>
              <div className="border-t border-slate-700/60">
                {satisfiedCriteria.map((cr, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/30 last:border-b-0">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div className="flex items-center gap-2">
                      <RuleTag type={cr.rule.type} />
                      <span className="text-sm text-slate-300">{cr.rule.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {/* Unresolved criteria — HITL dispatch + override */}
            <div>
              <h3 className="text-sm font-semibold text-amber-400/80 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unresolved — review and authorize each resolution workflow
              </h3>
              <div className="space-y-3">
                {unresolvedCriteria.map((cr, i) => {
                  const isDispatched   = dispatched.includes(cr.rule.label)
                  const isPending      = pendingDispatch.includes(cr.rule.label)
                  const isOverriding   = pendingOverride === cr.rule.label
                  const overrideNote   = overrides[cr.rule.label]
                  const borderClass    = overrideNote ? 'border-blue-500/25' :
                                         isDispatched  ? 'border-emerald-500/20' :
                                         isPending     ? 'border-amber-500/40' :
                                                         'border-amber-500/20'
                  return (
                    <div key={i} className={`bg-slate-800/40 border rounded-xl overflow-hidden ${borderClass}`}>
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                        {overrideNote
                          ? <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                          : isDispatched
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <RuleTag type={cr.rule.type} />
                          <p className="text-sm text-white">{cr.rule.label}</p>
                        </div>
                        {overrideNote && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            AM OVERRIDE
                          </span>
                        )}
                      </div>

                      {/* Card body — state-conditional */}
                      {overrideNote ? (
                        // Overridden state
                        <div className="px-4 py-3 bg-blue-950/20 space-y-1.5">
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">status</span>
                            <span className="text-blue-400 font-bold tracking-wide">SATISFIED</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">override_by</span>
                            <span className="text-slate-300">Account Manager</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">rationale</span>
                            <span className="text-slate-300 italic leading-relaxed">{overrideNote}</span>
                          </div>
                        </div>
                      ) : isPending && cr.workflowPlan ? (
                        // Dispatch confirmation state — AM reviews what will fire
                        <div className="px-4 py-3 bg-amber-950/20 space-y-3">
                          <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                            <Info className="w-3.5 h-3.5" />Review workflow before authorizing
                          </p>
                          <div className="space-y-1.5">
                            {[
                              { k: 'action',     v: cr.workflowPlan.action },
                              { k: 'recipient',  v: cr.workflowPlan.recipient },
                              { k: 'channel',    v: cr.workflowPlan.channel },
                              { k: 'turnaround', v: cr.workflowPlan.turnaround },
                            ].map(({ k, v }) => (
                              <div key={k} className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-24 shrink-0">{k}</span>
                                <span className="text-slate-200">{v}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 pt-1 border-t border-amber-500/10">
                            <button onClick={() => cancelPendingDispatch(cr.rule.label)}
                              className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => confirmDispatch(cr.rule.label)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" />Confirm &amp; Dispatch
                            </button>
                          </div>
                        </div>
                      ) : isOverriding ? (
                        // Override form state
                        <div className="px-4 py-3 bg-slate-900/50 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Amend AI finding — edit below to correct any inaccuracies</p>
                            <p className="text-xs text-slate-500 mt-0.5">Pre-filled with AI analysis. Change only what needs correction. Saved verbatim to audit trail.</p>
                          </div>
                          <textarea
                            value={overrideInput}
                            onChange={e => setOverrideInput(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                            rows={4}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setPendingOverride(null); setOverrideInput('') }}
                              className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                              Cancel
                            </button>
                            <button onClick={() => applyOverride(cr.rule.label)} disabled={!overrideInput.trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors">
                              <CheckCircle className="w-3.5 h-3.5" />Apply Override
                            </button>
                          </div>
                        </div>
                      ) : isDispatched ? (
                        // Dispatched state
                        <div className="px-4 py-3 bg-emerald-950/20 space-y-1.5">
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">status</span>
                            <span className="text-emerald-400 font-bold tracking-wide">DISPATCHED</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">awaiting</span>
                            <span className="text-slate-300">{cr.workflowPlan?.recipient ?? 'Provider response'}</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">turnaround</span>
                            <span className="text-slate-300">{cr.workflowPlan?.turnaround ?? '—'}</span>
                          </div>
                        </div>
                      ) : (
                        // Default unresolved state
                        <div className="px-4 py-3 bg-slate-900/30 space-y-1.5">
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">status</span>
                            <span className="text-amber-400 font-bold tracking-wide">UNRESOLVED</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">source_doc</span>
                            <span className="text-slate-300">{cr.docSource}</span>
                          </div>
                          <div className="flex items-start gap-3 text-xs">
                            <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">excerpt</span>
                            <span className="text-slate-400 italic leading-relaxed">{cr.note}</span>
                          </div>
                          {cr.suggestedAction && (
                            <div className="flex items-start gap-3 text-xs pt-2 mt-1 border-t border-slate-700/40">
                              <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">resolution_path</span>
                              <span className="text-slate-300 leading-relaxed">{cr.suggestedAction}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action footer — only shown in default unresolved state */}
                      {!isDispatched && !isPending && !isOverriding && !overrideNote && (
                        <div className="px-4 py-3 border-t border-slate-700/60 flex items-center justify-between gap-3">
                          <button onClick={() => { setPendingOverride(cr.rule.label); setOverrideInput(cr.note) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600/50 rounded-lg text-xs font-medium transition-colors">
                            Override
                          </button>
                          <button onClick={() => stagePendingDispatch(cr.rule.label)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors">
                            <Zap className="w-3.5 h-3.5" />Dispatch Workflow
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="flex gap-3 pt-1 flex-wrap">
              {allResolved ? (
                <button onClick={onReset}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <ChevronRight className="w-4 h-4" />Return to Portfolio
                </button>
              ) : (
                <button onClick={dispatchAll}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/20 rounded-lg text-sm font-medium transition-colors">
                  <Zap className="w-4 h-4" />Review All Remaining Workflows
                </button>
              )}
              {onSaveToPortfolio && (
                <button onClick={onSaveToPortfolio}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <Users className="w-4 h-4" />Save to Portfolio
                </button>
              )}
              <button onClick={onReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                <RotateCcw className="w-4 h-4" />Reset Demo
              </button>
            </div>
          </div>

        ) : phase === 'done' ? (
          // ── Clean Approval ───────────────────────────────────────────────
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-400">
                  {reviewMode ? 'AI Pipeline Complete · Ready for Your Review' : 'Case Approved'}
                </h2>
                <p className="text-sm text-emerald-300/70">
                  All {scenario.criteriaResults.length} criteria satisfied · Prior authorization appeal recommended
                </p>
              </div>
            </div>

            {/* Completed pipeline trail — only shown when pipeline was run this session */}
            {stepIdx === pipelineSteps.length - 1 && (
              <div id="tour-pipeline-trail" className="border border-slate-700/60 rounded-xl overflow-hidden">
                <button
                  onClick={() => setTraceOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-300">Pipeline Run — {pipelineSteps.length} nodes completed</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />
                </button>
                {/* Horizontal stepper — always visible as summary */}
                <div className="px-6 py-4 border-b border-slate-700/40 bg-slate-900/20">
                  <div className="grid grid-cols-4">
                    {pipelineSteps.map((step, i) => (
                      <div key={i} className="relative flex flex-col items-center">
                        {i < pipelineSteps.length - 1 && (
                          <div className="absolute top-5 left-1/2 w-full h-px z-0 bg-emerald-500" />
                        )}
                        <div className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-emerald-500/20 border-emerald-500">
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium mt-1.5 text-center leading-tight text-emerald-400">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {traceOpen && (
                  <div className="divide-y divide-slate-700/40">
                    {pipelineSteps.map((step, i) => {
                      const trailIcons = [FileText, Search, GitBranch, Shield]
                      const TrailIcon = trailIcons[i]
                      return (
                        <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-900/20">
                          <TrailIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-slate-300">{step.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.explanation}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div id="tour-criteria-audit">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Extraction Audit Trail</h3>
              <div className="space-y-3">
                {scenario.criteriaResults.map((cr, i) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                      {cr.status === 'found'
                        ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                      <div className="flex items-center gap-2 flex-wrap">
                        <RuleTag type={cr.rule.type} />
                        <p className="text-sm text-white">{cr.rule.label}</p>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-slate-900/30 space-y-1.5">
                      {(() => {
                        const cite = scenario.citations[cr.rule.label]
                        return cite ? (
                          <>
                            <div className="flex items-start gap-3 text-xs font-mono">
                              <span className="text-slate-600 w-28 shrink-0">source_document</span>
                              <span className="text-slate-300">{cite.source}</span>
                            </div>
                            <div className="flex items-start gap-3 text-xs font-mono">
                              <span className="text-slate-600 w-28 shrink-0">page_ref</span>
                              <span className="text-slate-300">{cite.page}</span>
                            </div>
                            <div className="flex items-start gap-3 text-xs font-mono">
                              <span className="text-slate-600 w-28 shrink-0">extracted_text</span>
                              <span className="text-slate-400 font-sans italic leading-relaxed">&ldquo;{cite.text}&rdquo;</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-start gap-3 text-xs font-mono">
                            <span className="text-slate-600 w-28 shrink-0">extracted_text</span>
                            <span className="text-slate-400 font-sans italic">Supporting documentation confirmed.</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-1 flex-wrap">
              {reviewMode ? (
                <button id="tour-review-btn" onClick={() => setPhase('review')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <CheckCircle className="w-4 h-4" />Approve &amp; Submit Appeal
                </button>
              ) : (
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <Download className="w-4 h-4" />Download Generated Appeal (PDF)
                </button>
              )}
              {onSaveToPortfolio && (
                <button onClick={onSaveToPortfolio}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <Users className="w-4 h-4" />Save to Portfolio
                </button>
              )}
              <button onClick={onReset}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                <RotateCcw className="w-4 h-4" />Reset Demo
              </button>
            </div>
          </div>
        ) : (
          <>
            {phase === 'idle' && (
              <button id="tour-execute-btn" onClick={handleExecute}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                <Zap className="w-4 h-4" />Execute Full Pipeline
              </button>
            )}
            {phase === 'loading' && (() => {
              const stepIcons = [FileText, Search, GitBranch, Shield]
              const TourIcon = stepIcons[tourIdx]
              const tourStepDone = tourIdx < stepIdx
              return (
                <div className="space-y-4">
                  {/* Horizontal stepper */}
                  <div className="grid grid-cols-4">
                    {pipelineSteps.map((step, i) => {
                      const isComplete = i < stepIdx
                      const isCurrent = i === stepIdx
                      const StepIcon = stepIcons[i]
                      return (
                        <div
                          key={i}
                          className="relative flex flex-col items-center cursor-pointer group"
                          onClick={() => i <= stepIdx && setTourIdx(i)}
                        >
                          {i < pipelineSteps.length - 1 && (
                            <div className={`absolute top-5 left-1/2 w-full h-px z-0 transition-colors duration-700 ${
                              isComplete ? 'bg-emerald-500' : 'bg-slate-700'
                            }`} />
                          )}
                          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                            isComplete ? 'bg-emerald-500/20 border-emerald-500' :
                            isCurrent ? 'bg-blue-500/20 border-blue-400' :
                            'bg-slate-800 border-slate-700'
                          } ${tourIdx === i && i <= stepIdx ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white/20' : ''}`}>
                            {isComplete
                              ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                              : isCurrent
                              ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                              : <StepIcon className="w-5 h-5 text-slate-600" />}
                          </div>
                          <span className={`text-xs font-medium mt-1.5 text-center leading-tight ${
                            isComplete ? 'text-emerald-400' :
                            isCurrent ? 'text-blue-300' :
                            'text-slate-600'
                          } ${i <= stepIdx ? 'group-hover:brightness-125' : ''}`}>{step.label}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Tour card */}
                  <div className="bg-slate-800/70 border border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/40">
                      <div className="flex items-center gap-2.5">
                        <TourIcon className={`w-4 h-4 ${tourStepDone ? 'text-emerald-400' : 'text-blue-400'}`} />
                        <span className="text-sm font-semibold text-white">{pipelineSteps[tourIdx].label}</span>
                        {tourStepDone && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Complete</span>}
                      </div>
                      <span className="text-xs text-slate-500">Step {tourIdx + 1} of {pipelineSteps.length}</span>
                    </div>
                    <div className="px-4 py-4 min-h-[80px]">
                      {tourStepDone ? (
                        <p className="text-sm text-slate-300 leading-relaxed">{pipelineSteps[tourIdx].explanation}</p>
                      ) : (
                        <div className="flex items-start gap-2.5">
                          <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                          <p className="text-sm text-blue-300">{pipelineSteps[tourIdx].loadingText}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/40 bg-slate-900/30">
                      <button
                        onClick={() => setTourIdx(prev => Math.max(0, prev - 1))}
                        disabled={tourIdx === 0}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />Previous
                      </button>
                      <div className="flex gap-1.5">
                        {pipelineSteps.map((_, i) => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            tourIdx === i ? 'bg-blue-400' : i < stepIdx ? 'bg-emerald-600' : i === stepIdx ? 'bg-blue-800' : 'bg-slate-700'
                          }`} />
                        ))}
                      </div>
                      <button
                        onClick={() => setTourIdx(prev => Math.min(stepIdx, prev + 1))}
                        disabled={tourIdx >= stepIdx}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                      >
                        Next<ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {stepIdx === pipelineSteps.length - 1 ? (
                    <button
                      onClick={() => setPhase('done')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />Continue to Appeal Letter
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 text-center">Universal pipeline · {scenario.configFile}</p>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View 4 — Ontology Library
// ---------------------------------------------------------------------------

function LibraryView({ onUseTemplate, clients }: {
  onUseTemplate: (scenarioId: string) => void
  clients: Client[]
}) {
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null)
  const [showJson, setShowJson] = useState<string | null>(null)

  // Group configs by drugKey, preserving insertion order
  const allScenarioList = Object.values(scenarios)
  const drugKeyOrder = [...new Set(allScenarioList.map(sc => sc.drugKey))]
  const byDrugKey = allScenarioList.reduce<Record<string, ScenarioConfig[]>>((acc, sc) => {
    if (!acc[sc.drugKey]) acc[sc.drugKey] = []
    acc[sc.drugKey].push(sc)
    return acc
  }, {})

  // Count of active portfolio cases per scenario (supports multiple cases per config)
  const caseCountByScenario = clients.reduce<Record<string, number>>((acc, c) => {
    acc[c.scenarioId] = (acc[c.scenarioId] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white">Ontology Library</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Universal rule primitives assembled into drug × carrier configurations — no prompt engineering required
        </p>
      </div>

      <div className="p-8 space-y-10 max-w-4xl">

        {/* How configs are built */}
        <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/60 rounded-xl">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-300">How drug configurations are built</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Configs are authored by Paxos Health's clinical implementation team during client onboarding — not by AMs.
              When a new MedTech partner signs on, the team reviews the payer's PA policy for that drug, translates it into
              the four rule primitives below, and publishes the config to this Library. The AM's job is to <em className="text-slate-400 not-italic font-medium">use</em> configs, not write them.
              For self-insured employer plans, only the delta (changed parameters) is stored as an override — the rest is inherited from the carrier base.
            </p>
          </div>
        </div>

        {/* Layer 1: Universal Primitives */}
        <div id="tour-layer1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">1</div>
            <div>
              <h2 className="text-base font-semibold text-white">Universal Rule Primitives</h2>
              <p className="text-xs text-slate-500">The four atomic building blocks. Every extraction pipeline is composed from these — they are never rewritten, only parameterized.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {universalPrimitives.map(p => (
              <div key={p.type} id={`tour-primitive-${p.type}`} className={`rounded-xl border p-4 ${ruleColors[p.type]} border-opacity-30`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded border ${ruleColors[p.type]}`}>{ruleIcons[p.type]}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs font-mono text-slate-400">{p.schemaClass}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-3">{p.description}</p>
                <div className="bg-slate-900/50 rounded-lg p-2.5 font-mono text-xs space-y-0.5">
                  {p.params.map(param => (
                    <p key={param} className="text-slate-400">{param}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Layer 2: Drug × Carrier Configurations */}
        <div id="tour-layer2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">2</div>
            <div>
              <h2 className="text-base font-semibold text-white">Drug × Carrier Configurations</h2>
              <p className="text-xs text-slate-500">
                One config per supported drug–carrier combination. Self-insured plans store only the delta — changed or added
                parameters on top of the carrier base. The pipeline loads the base and patches in the override automatically.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {drugKeyOrder.map(drugKey => {
              const group = byDrugKey[drugKey]
              const baseConfigs = group.filter(sc => !sc.parentConfigId)
              const overridesByParent = group
                .filter(sc => sc.parentConfigId)
                .reduce<Record<string, ScenarioConfig[]>>((acc, sc) => {
                  const pid = sc.parentConfigId!
                  if (!acc[pid]) acc[pid] = []
                  acc[pid].push(sc)
                  return acc
                }, {})
              const isGrouped = group.length > 1
              const activeCaseCount = group.reduce((n, sc) => n + (caseCountByScenario[sc.id] ?? 0), 0)

              return (
                <div
                  key={drugKey}
                  id={drugKey === 'ozempic' ? 'tour-drug-ozempic' : undefined}
                  className={isGrouped ? 'border border-slate-700/60 rounded-2xl overflow-hidden' : ''}
                >
                  {/* Drug group header (only when multiple configs) */}
                  {isGrouped && (
                    <div className="px-5 py-3 bg-slate-800/70 border-b border-slate-700/60 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <p className="text-sm font-semibold text-white">{group[0].drug.split(' ')[0]}</p>
                        <span className="text-slate-600">·</span>
                        <p className="text-xs text-slate-400">{group[0].categoryLabel}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono">
                          {group[0].drug.match(/\((.+)\)/)?.[1] ?? ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{group.length} configs</span>
                        {activeCaseCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 border border-slate-600/30">
                            {activeCaseCount} active case{activeCaseCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Base configs + their overrides */}
                  <div className={isGrouped ? 'divide-y divide-slate-700/40' : ''}>
                    {baseConfigs.map(sc => {
                      const isOpen = expandedConfig === sc.id
                      const jsonOpen = showJson === sc.id
                      const caseCount = caseCountByScenario[sc.id] ?? 0
                      const isTemplate = caseCount === 0
                      const typeCounts = sc.criteriaResults.reduce<Record<string, number>>((acc, r) => {
                        acc[r.rule.type] = (acc[r.rule.type] ?? 0) + 1; return acc
                      }, {})

                      return (
                        <div key={sc.id}>
                          {/* Base config card */}
                          <div className={isGrouped ? '' : 'bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden'}>
                            <button
                              onClick={() => setExpandedConfig(isOpen ? null : sc.id)}
                              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/60 transition-colors text-left"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isTemplate ? 'bg-emerald-900/50' : 'bg-slate-700'}`}>
                                  {isTemplate ? <BookmarkPlus className="w-4 h-4 text-emerald-400" /> : <Package className="w-4 h-4 text-slate-300" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-mono text-emerald-400">{sc.configFile}</p>
                                    {isTemplate && (
                                      <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">New template</span>
                                    )}
                                    {caseCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-400 border border-slate-600/30">
                                        {caseCount} case{caseCount !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">{sc.drug} · {sc.plan}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex gap-1.5 flex-wrap">
                                  {(Object.keys(typeCounts) as RuleType[]).map(t => (
                                    <span key={t} className={`px-1.5 py-0.5 rounded text-xs border ${ruleColors[t]}`}>{typeCounts[t]} {t}</span>
                                  ))}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-slate-700/60">
                                <div className="px-5 py-4 space-y-2">
                                  {sc.criteriaResults.map((cr, i) => (
                                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                                      <div className={`mt-0.5 shrink-0 p-1.5 rounded border ${ruleColors[cr.rule.type]}`}>{ruleIcons[cr.rule.type]}</div>
                                      <div className="min-w-0">
                                        <RuleTag type={cr.rule.type} />
                                        <p className="text-sm text-slate-200 mt-1 leading-snug">{cr.rule.label}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="px-5 pb-4 space-y-2">
                                  <button onClick={() => setShowJson(jsonOpen ? null : sc.id)}
                                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                                    <Code className="w-3.5 h-3.5" />{jsonOpen ? 'Hide' : 'View'} full configuration JSON
                                    <ChevronDown className={`w-3 h-3 transition-transform ${jsonOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  {jsonOpen && (
                                    <pre className="bg-slate-900/70 border border-slate-700/60 rounded-lg p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">{sc.configJson}</pre>
                                  )}
                                  <button onClick={() => onUseTemplate(sc.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors">
                                    <Plus className="w-4 h-4" />Use This Template — New Case
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Override configs nested under this base */}
                          {(overridesByParent[sc.id] ?? []).map(ov => {
                            const ovOpen = expandedConfig === ov.id
                            const ovJsonOpen = showJson === ov.id
                            const ovCaseCount = caseCountByScenario[ov.id] ?? 0

                            return (
                              <div key={ov.id} className="ml-6 border-l-2 border-slate-700/50">
                                <div className="border-b border-slate-700/40 last:border-b-0">
                                  <button
                                    onClick={() => setExpandedConfig(ovOpen ? null : ov.id)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center shrink-0">
                                        <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-mono text-amber-400">{ov.configFile}</p>
                                          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-700/50 text-slate-400 border border-slate-600/30 font-mono">
                                            self_insured_override
                                          </span>
                                          {ovCaseCount > 0 && (
                                            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                              {ovCaseCount} case{ovCaseCount !== 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          Extends <span className="text-slate-400 font-mono">{sc.configFile}</span> · {ov.plan}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      {ov.overriddenFields && (
                                        <span className="text-xs text-slate-500 hidden sm:block">
                                          {ov.overriddenFields.length} override{ov.overriddenFields.length !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${ovOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>

                                  {ovOpen && (
                                    <div className="border-t border-slate-700/40">
                                      {/* Override diff table */}
                                      {ov.overriddenFields && (
                                        <div className="px-5 py-4 border-b border-slate-700/40">
                                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                            Overrides from base ({sc.configFile})
                                          </p>
                                          <div className="space-y-2">
                                            {ov.overriddenFields.map(field => (
                                              <div key={field.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/40">
                                                <div>
                                                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{field.label}</p>
                                                  <p className="text-sm text-slate-400 font-mono">{field.base}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-amber-500 shrink-0" />
                                                <div>
                                                  <p className="text-xs text-amber-500 uppercase tracking-wide mb-0.5">This plan</p>
                                                  <p className="text-sm text-amber-300 font-mono font-medium">{field.override}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* Full effective rules */}
                                      <div className="px-5 py-4 space-y-2">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                          Full effective criteria (base + overrides)
                                        </p>
                                        {ov.criteriaResults.map((cr, i) => (
                                          <div key={i} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30">
                                            <div className={`mt-0.5 shrink-0 p-1.5 rounded border ${ruleColors[cr.rule.type]}`}>{ruleIcons[cr.rule.type]}</div>
                                            <div className="min-w-0">
                                              <RuleTag type={cr.rule.type} />
                                              <p className="text-sm text-slate-200 mt-1 leading-snug">{cr.rule.label}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      <div className="px-5 pb-4 space-y-2">
                                        <button onClick={() => setShowJson(ovJsonOpen ? null : ov.id)}
                                          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                                          <Code className="w-3.5 h-3.5" />{ovJsonOpen ? 'Hide' : 'View'} override delta JSON
                                          <ChevronDown className={`w-3 h-3 transition-transform ${ovJsonOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {ovJsonOpen && (
                                          <pre className="bg-slate-900/70 border border-slate-700/60 rounded-lg p-4 text-xs font-mono text-amber-300 overflow-x-auto leading-relaxed">{ov.configJson}</pre>
                                        )}
                                        <button onClick={() => onUseTemplate(ov.id)}
                                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium transition-colors">
                                          <Plus className="w-4 h-4" />Use This Template — New Case
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export default function App() {
  const [view, setView] = useState<View>('portfolio')
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [preloadedScenarioId, setPreloadedScenarioId] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<ScenarioConfig | null>(null)
  const [reviewMode, setReviewMode] = useState(false)
  const [autoStart, setAutoStart] = useState(false)
  const [openedCaseStatus, setOpenedCaseStatus] = useState<CaseStatus | null>(null)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const addToPortfolio = (scenario: ScenarioConfig) => {
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const name = scenario.clientType === 'patient'
      ? `Case #PH-${Math.floor(Math.random() * 9000) + 1000}`
      : scenario.manufacturer
    setClients(prev => [...prev, {
      id: Date.now(),
      name,
      drug: scenario.drug.split(' ')[0],
      categoryLabel: scenario.categoryLabel,
      status: (scenario.criteriaResults.some(r => r.status === 'needs_review') ? 'exception' : 'ready_for_review') as CaseStatus,
      clientType: scenario.clientType,
      lastUpdated: now,
      scenarioId: scenario.id,
    }])
    setActiveScenario(null)
    setPreloadedScenarioId(null)
    setReviewMode(false)
    setView('portfolio')
  }

  // Portfolio click: ready_for_review/submitted → jump to POC done state (AM reviews AI work)
  // exception → go to intake for investigation (shows UNRESOLVED + suggested actions)
  const openCase = (scenarioId: string, status: CaseStatus) => {
    const scenario = scenarios[scenarioId]
    if (!scenario) return
    if (status === 'ready_for_review' || status === 'submitted' || status === 'exception' || status === 'payer_response') {
      setActiveScenario(scenario)
      setReviewMode(true)
      setOpenedCaseStatus(status)
      setView('poc')
    } else {
      setPreloadedScenarioId(scenarioId)
      setReviewMode(false)
      setOpenedCaseStatus(null)
      setView('intake')
    }
  }

  const openNew = (scenarioId?: string) => {
    setPreloadedScenarioId(scenarioId ?? null)
    setReviewMode(false)
    setView('intake')
  }

  const handleLaunch = (scenario: ScenarioConfig) => {
    setActiveScenario(scenario)
    setReviewMode(false)
    setAutoStart(true)
    setOpenedCaseStatus(null)
    setView('poc')
  }

  const handleReset = () => {
    setActiveScenario(null)
    setPreloadedScenarioId(null)
    setReviewMode(false)
    setAutoStart(false)
    setOpenedCaseStatus(null)
    setView('portfolio')
  }

  const startTour = () => {
    setView('portfolio')
    setTourStepIndex(0)
    setTourRunning(true)
  }

  const handleJoyrideCallback = (data: { action: string; index: number; status: string; type: string }) => {
    const { action, index, status, type } = data

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setTourRunning(false)
      return
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const isNext = action === ACTIONS.NEXT
      const isPrev = action === ACTIONS.PREV
      if (!isNext && !isPrev) return

      const next = index + (isNext ? 1 : -1)

      if (isNext) {
        // Step 2 (Ozempic case card) → open Ozempic in done/review mode
        if (index === 2) {
          setActiveScenario(scenarios['novo-ozempic'])
          setReviewMode(true)
          setOpenedCaseStatus('ready_for_review')
          setAutoStart(false)
          setView('poc')
          setTimeout(() => setTourStepIndex(3), 400)
          return
        }
        // Step 6 (review button) → back to portfolio for case 2
        if (index === 6) {
          setActiveScenario(null)
          setView('portfolio')
          setTimeout(() => setTourStepIndex(7), 350)
          return
        }
        // Step 7 (infant case card) → open infant in payer_response mode
        if (index === 7) {
          setActiveScenario(scenarios['infant-omeprazole'])
          setReviewMode(true)
          setOpenedCaseStatus('payer_response')
          setAutoStart(false)
          setView('poc')
          setTimeout(() => setTourStepIndex(8), 400)
          return
        }
      }

      if (isPrev) {
        // Step 3 (Ozempic pipeline header) → back to portfolio
        if (index === 3) {
          setActiveScenario(null)
          setView('portfolio')
          setTimeout(() => setTourStepIndex(2), 350)
          return
        }
        // Step 7 (infant card) → reopen Ozempic POC at review button step
        if (index === 7) {
          setActiveScenario(scenarios['novo-ozempic'])
          setReviewMode(true)
          setOpenedCaseStatus('ready_for_review')
          setAutoStart(false)
          setView('poc')
          setTimeout(() => setTourStepIndex(6), 400)
          return
        }
        // Step 8 (payer response) → back to portfolio
        if (index === 8) {
          setActiveScenario(null)
          setView('portfolio')
          setTimeout(() => setTourStepIndex(7), 350)
          return
        }
      }

      setTourStepIndex(next)
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Joyride
        steps={TOUR_STEPS}
        run={tourRunning}
        stepIndex={tourStepIndex}
        onEvent={handleJoyrideCallback as Parameters<typeof Joyride>[0]['onEvent']}
        continuous
        scrollToFirstStep
        styles={JOYRIDE_STYLES}
        options={{
          arrowColor: '#1e293b',
          backgroundColor: '#1e293b',
          overlayColor: 'rgba(2, 6, 23, 0.6)',
          primaryColor: '#10b981',
          textColor: '#cbd5e1',
          zIndex: 200,
          width: 400,
          buttons: ['back', 'primary', 'skip'],
          showProgress: true,
          overlayClickAction: false,
          skipBeacon: true,
        }}
      />
      <Sidebar view={view} setView={setView} onStartTour={startTour} />
      {view === 'portfolio' && (
        <PortfolioView clients={clients} onNew={() => openNew()} onOpenCase={openCase} />
      )}
      {view === 'intake' && (
        <IntakeView
          key={preloadedScenarioId ?? 'new'}
          preloadedScenarioId={preloadedScenarioId}
          onLaunch={handleLaunch}
        />
      )}
      {view === 'poc' && activeScenario && (
        <POCView
          key={activeScenario.id}
          scenario={activeScenario}
          onReset={handleReset}
          reviewMode={reviewMode}
          autoStart={autoStart}
          caseStatus={openedCaseStatus ?? undefined}
          onSaveToPortfolio={
            clients.some(c => c.scenarioId === activeScenario.id)
              ? undefined
              : () => addToPortfolio(activeScenario)
          }
        />
      )}
      {view === 'library' && (
        <LibraryView onUseTemplate={openNew} clients={clients} />
      )}
    </div>
  )
}
