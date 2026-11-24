import { Building2, Database, FileText, FolderInput, HeartPulse, Upload, Users, Webhook } from 'lucide-react'
import { type IconType } from '../types'

export interface Connector {
  id: string
  name: string
  icon: IconType
  category: 'Clinical' | 'Document' | 'Batch' | 'API' | 'CRM'
  vendors: string
  ingests: string
  canonicalFields: string[]
  deployments: number
}

export const CATEGORY_CLS: Record<Connector['category'], string> = {
  Clinical: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
  Document: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
  Batch: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  API: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  CRM: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

export const CONNECTORS: Connector[] = [
  { id: 'ehr-fhir', name: 'EHR via FHIR', icon: Database, category: 'Clinical', vendors: 'Epic · Cerner · Athena', ingests: 'Clinical notes, labs, problem list, medications', canonicalFields: ['diagnosis', 'lab_values', 'medication_history', 'clinical_notes'], deployments: 22 },
  { id: 'lis-hl7', name: 'Lab System (HL7 v2)', icon: HeartPulse, category: 'Clinical', vendors: 'LIS · ORU^R01 feed', ingests: 'Lab orders and results', canonicalFields: ['lab_values', 'test_dates', 'ordering_provider'], deployments: 9 },
  { id: 'fax-ocr', name: 'Fax / Document Intake', icon: FileText, category: 'Document', vendors: 'OCR · pytesseract', ingests: 'Faxed denials, prescriptions, payer letters', canonicalFields: ['denial_text', 'denial_reason', 'payer_response'], deployments: 38 },
  { id: 'sftp-csv', name: 'SFTP / CSV Batch', icon: FolderInput, category: 'Batch', vendors: 'SFTP · scheduled job', ingests: 'Order exports, eligibility files', canonicalFields: ['drug', 'member_id', 'order_date', 'plan_id'], deployments: 14 },
  { id: 'rest-api', name: 'REST API / Webhook', icon: Webhook, category: 'API', vendors: 'JSON · OAuth2', ingests: 'Real-time events from the client application', canonicalFields: ['drug', 'diagnosis', 'patient_demographics', 'plan_id'], deployments: 11 },
  { id: 'patient-upload', name: 'Patient Upload Portal', icon: Upload, category: 'Document', vendors: 'PDF · image OCR', ingests: 'Patient-submitted documents and photos', canonicalFields: ['denial_text', 'clinical_notes', 'insurance_card'], deployments: 17 },
  { id: 'crm', name: 'CRM (Health Cloud)', icon: Users, category: 'CRM', vendors: 'Salesforce Health Cloud', ingests: 'Patient hub records, case management', canonicalFields: ['patient_demographics', 'plan_id', 'case_notes', 'denial_reason'], deployments: 7 },
]

export interface FieldMapping {
  source: string
  canonical: string
  confidence: number
}

export interface OnboardingTemplate {
  id: string
  company: string
  type: string
  icon: IconType
  blurb: string
  dataStory: string
  connectorIds: string[]
  fieldMappings: FieldMapping[]
  policyPacks: { name: string; category: string; market: 'commercial' | 'individual' | 'medicare_advantage' }[]
  hitl: { routine: number; complex: number; exception: number }
  validation: { sampleCases: number; reusePct: number; timeEstimate: string; netNew: string }
}

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'acme-digital', company: 'ACME Digital Health', type: 'Digital Health · DTC telehealth app', icon: Webhook,
    blurb: 'App-based GLP-1 telehealth service. No EHR, no HL7 — clinical data lives in their own application database.',
    dataStory: 'Data flows through REST API and patient uploads — normalized into the canonical schema with zero EHR integration required.',
    connectorIds: ['rest-api', 'patient-upload', 'fax-ocr'],
    fieldMappings: [
      { source: 'app.member.dx_code', canonical: 'diagnosis', confidence: 98 },
      { source: 'app.rx.ndc', canonical: 'drug', confidence: 96 },
      { source: 'app.insurance.payer_id', canonical: 'plan_id', confidence: 99 },
      { source: 'upload[].ocr_text', canonical: 'denial_text', confidence: 91 },
      { source: 'fax.classified_reason', canonical: 'denial_reason', confidence: 88 },
    ],
    policyPacks: [
      { name: 'ozempic_cigna_base', category: 'Endocrinology', market: 'commercial' },
      { name: 'esomeprazole_uhc_pediatric', category: 'Gastroenterology', market: 'commercial' },
    ],
    hitl: { routine: 60, complex: 28, exception: 12 },
    validation: { sampleCases: 10, reusePct: 94, timeEstimate: '~45 min', netNew: 'App-JSON adapter mapping only' },
  },
  {
    id: 'beacon-hub', company: 'Beacon Patient Hub', type: 'Specialty pharma · hub services', icon: Users,
    blurb: 'Patient-services hub for a specialty hepatology drug. Case data lives in a Salesforce Health Cloud CRM.',
    dataStory: 'Clinical and coverage data come from Salesforce Health Cloud CRM and intake forms, normalized into the shared schema.',
    connectorIds: ['crm', 'patient-upload', 'fax-ocr'],
    fieldMappings: [
      { source: 'Patient__c.Diagnosis__c', canonical: 'diagnosis', confidence: 97 },
      { source: 'Therapy__c.Product__c', canonical: 'drug', confidence: 99 },
      { source: 'Coverage__c.PlanId__c', canonical: 'plan_id', confidence: 98 },
      { source: 'Case.Denial_Reason__c', canonical: 'denial_reason', confidence: 90 },
      { source: 'upload[].ocr_text', canonical: 'denial_text', confidence: 92 },
    ],
    policyPacks: [{ name: 'livdelzi_cigna_hepatology', category: 'Hepatology', market: 'commercial' }],
    hitl: { routine: 45, complex: 35, exception: 20 },
    validation: { sampleCases: 8, reusePct: 91, timeEstimate: '~1 hour', netNew: 'CRM object field map only' },
  },
  {
    id: 'meridian-health', company: 'Meridian Health System', type: 'Integrated health system · multi-specialty', icon: Building2,
    blurb: 'Regional hospital network running Epic across endocrinology, GI, hepatology, and rheumatology.',
    dataStory: 'Live Epic FHIR feed plus HL7 ORU labs and inbound fax normalized into the same canonical schema every deployment shares.',
    connectorIds: ['ehr-fhir', 'lis-hl7', 'fax-ocr'],
    fieldMappings: [
      { source: 'Patient.Condition.code', canonical: 'diagnosis', confidence: 97 },
      { source: 'MedicationRequest.medicationCode', canonical: 'drug', confidence: 95 },
      { source: 'Coverage.payor.identifier', canonical: 'plan_id', confidence: 99 },
      { source: 'Observation.value (HL7 ORU)', canonical: 'lab_values', confidence: 96 },
      { source: 'fax.classified_reason', canonical: 'denial_reason', confidence: 88 },
    ],
    policyPacks: [
      { name: 'ozempic_cigna_base', category: 'Endocrinology', market: 'commercial' },
      { name: 'esomeprazole_uhc_pediatric', category: 'Gastroenterology', market: 'commercial' },
      { name: 'livdelzi_cigna_hepatology', category: 'Hepatology', market: 'commercial' },
    ],
    hitl: { routine: 55, complex: 30, exception: 15 },
    validation: { sampleCases: 12, reusePct: 93, timeEstimate: '~2 hours', netNew: 'Epic FHIR resource map only' },
  },
]

export const ONBOARD_STEPS = ['Client Profile', 'Data Sources', 'Field Mapping', 'Coverage Scope', 'Review Tiers', 'Validate & Launch']

export interface SamplePayloadPreview {
  rawFormat: string
  rawSnippet: string
  normalizedJson: Record<string, string>
  deidTokenPreview: string
}

const PAYLOAD_PREVIEWS: Record<string, SamplePayloadPreview> = {
  'acme-digital': {
    rawFormat: 'REST Webhook JSON (app.member / app.rx)',
    rawSnippet: '{"member":{"dx_code":"E11.9"},"rx":{"ndc":"00169-4132-12"},"insurance":{"payer_id":"CIGNA-500"}}',
    normalizedJson: { drug: 'Ozempic (semaglutide) · RxCUI 1991302', diagnosis: 'Type 2 Diabetes (E11.9)', plan_id: 'CIGNA-500', denial_reason: 'Weight-loss confusion' },
    deidTokenPreview: '{{ENDOCRINOLOGIST_NAME_1}} · {{PATIENT_NAME_1}} · Date Shift: -42d',
  },
  'beacon-hub': {
    rawFormat: 'Salesforce Health Cloud SObject (Patient__c)',
    rawSnippet: 'Patient__c.Diagnosis__c="K74.3" · Therapy__c.Product__c="Livdelzi" · Coverage__c.PlanId__c="CIGNA-PPO"',
    normalizedJson: { drug: 'Livdelzi (seladelpar) · RxCUI 2689012', diagnosis: 'Primary Biliary Cholangitis (K74.3)', plan_id: 'CIGNA-PPO', denial_reason: 'Decompensation & specialist' },
    deidTokenPreview: '{{HEPATOLOGIST_NAME_1}} · {{PATIENT_NAME_1}} · Date Shift: -42d',
  },
  'meridian-health': {
    rawFormat: 'Epic FHIR R4 Bundle + HL7 ORU^R01',
    rawSnippet: 'Condition.code="K21.0" · MedicationRequest="Nexium 20mg Susp" · Observation.value="LA Grade B"',
    normalizedJson: { drug: 'Nexium Susp (esomeprazole) · RxCUI 283742', diagnosis: 'Pediatric GERD (K21.0)', plan_id: 'UHC-CHOICE-2026', lab_values: 'EGD LA Grade B; 23 kg; 20 mg × 56d' },
    deidTokenPreview: '{{GASTROENTEROLOGIST_NAME_1}} · {{PATIENT_NAME_1}} · Date Shift: -42d',
  },
}

export function getSamplePayloadPreview(templateId: string): SamplePayloadPreview {
  return PAYLOAD_PREVIEWS[templateId] ?? PAYLOAD_PREVIEWS['meridian-health']
}
