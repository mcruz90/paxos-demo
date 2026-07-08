import { useState, Fragment } from 'react'
import { Upload, FileText, CheckCircle, Loader2, Users, ChevronRight, Building2, Package, ChevronLeft, Info, Rocket, Boxes, Database, HeartPulse, FolderInput, Webhook, ArrowRight, Workflow, Beaker } from 'lucide-react'
import { type IconType, type View } from '../types'
import { RoleChip, IllustrativeTag } from './ui'
import { ReviewPolicyControl } from './ReviewPolicyControl'
import { MarketBadge } from './WorkflowSpecView'
import { RUBRIC_DIMENSIONS, METHOD_LABEL, thresholdLabel } from '../data/evalRubric'

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
  Batch:    'text-amber-400 bg-amber-500/10 border-amber-500/30',
  API:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  CRM:      'text-rose-400 bg-rose-500/10 border-rose-500/30',
}

export const CONNECTORS: Connector[] = [
  { id: 'ehr-fhir',       name: 'EHR via FHIR',          icon: Database,    category: 'Clinical', vendors: 'Epic · Cerner · Athena',  ingests: 'Clinical notes, labs, problem list, medications', canonicalFields: ['diagnosis', 'lab_values', 'medication_history', 'clinical_notes'], deployments: 22 },
  { id: 'lis-hl7',        name: 'Lab System (HL7 v2)',   icon: HeartPulse,  category: 'Clinical', vendors: 'LIS · ORU^R01 feed',      ingests: 'Lab orders and results',                          canonicalFields: ['lab_values', 'test_dates', 'ordering_provider'], deployments: 9 },
  { id: 'fax-ocr',        name: 'Fax / Document Intake', icon: FileText,    category: 'Document', vendors: 'OCR · pytesseract',       ingests: 'Faxed denials, prescriptions, payer letters',     canonicalFields: ['denial_text', 'denial_reason', 'payer_response'], deployments: 38 },
  { id: 'sftp-csv',       name: 'SFTP / CSV Batch',      icon: FolderInput, category: 'Batch',    vendors: 'SFTP · scheduled job',    ingests: 'Order exports, eligibility files',                canonicalFields: ['drug', 'member_id', 'order_date', 'plan_id'], deployments: 14 },
  { id: 'rest-api',       name: 'REST API / Webhook',    icon: Webhook,     category: 'API',      vendors: 'JSON · OAuth2',           ingests: 'Real-time events from the client application',    canonicalFields: ['drug', 'diagnosis', 'patient_demographics', 'plan_id'], deployments: 11 },
  { id: 'patient-upload', name: 'Patient Upload Portal', icon: Upload,      category: 'Document', vendors: 'PDF · image OCR',         ingests: 'Patient-submitted documents and photos',          canonicalFields: ['denial_text', 'clinical_notes', 'insurance_card'], deployments: 17 },
  { id: 'crm',            name: 'CRM (Health Cloud)',    icon: Users,       category: 'CRM',      vendors: 'Salesforce Health Cloud', ingests: 'Patient hub records, case management',            canonicalFields: ['patient_demographics', 'plan_id', 'case_notes', 'denial_reason'], deployments: 7 },
]

export interface FieldMapping { source: string; canonical: string; confidence: number }

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
    id: 'acme-digital',
    company: 'ACME Digital Health',
    type: 'Digital Health · DTC telehealth app',
    icon: Webhook,
    blurb: 'App-based GLP-1 telehealth service. No EHR, no HL7 — clinical data lives in their own application database.',
    dataStory: 'No EHR connector at all. Data flows in through their app’s REST API and patient-uploaded documents — the adapter normalizes app JSON into the same canonical schema every other client uses.',
    connectorIds: ['rest-api', 'patient-upload', 'fax-ocr'],
    fieldMappings: [
      { source: 'app.member.dx_code',        canonical: 'diagnosis',     confidence: 98 },
      { source: 'app.rx.ndc',                canonical: 'drug',          confidence: 96 },
      { source: 'app.insurance.payer_id',    canonical: 'plan_id',       confidence: 99 },
      { source: 'upload[].ocr_text',         canonical: 'denial_text',   confidence: 91 },
      { source: 'fax.classified_reason',     canonical: 'denial_reason', confidence: 88 },
    ],
    policyPacks: [
      { name: 'ozempic_cigna_base', category: 'Endocrinology', market: 'commercial' },
      { name: 'esomeprazole_uhc_pediatric', category: 'Gastroenterology', market: 'commercial' },
    ],
    hitl: { routine: 60, complex: 28, exception: 12 },
    validation: { sampleCases: 10, reusePct: 94, timeEstimate: '~45 min', netNew: 'App-JSON adapter mapping only' },
  },
  {
    id: 'beacon-hub',
    company: 'Beacon Patient Hub',
    type: 'Specialty pharma · hub services',
    icon: Users,
    blurb: 'Patient-services hub for a specialty hepatology drug. Case data lives in a Salesforce Health Cloud CRM.',
    dataStory: 'Clinical and coverage data come from their CRM, supplemented by patient intake forms and faxed denials. The adapter maps Salesforce objects into the canonical schema — no clinical-system integration required.',
    connectorIds: ['crm', 'patient-upload', 'fax-ocr'],
    fieldMappings: [
      { source: 'Patient__c.Diagnosis__c',  canonical: 'diagnosis',     confidence: 97 },
      { source: 'Therapy__c.Product__c',     canonical: 'drug',          confidence: 99 },
      { source: 'Coverage__c.PlanId__c',     canonical: 'plan_id',       confidence: 98 },
      { source: 'Case.Denial_Reason__c',     canonical: 'denial_reason', confidence: 90 },
      { source: 'upload[].ocr_text',         canonical: 'denial_text',   confidence: 92 },
    ],
    policyPacks: [
      { name: 'livdelzi_cigna_hepatology', category: 'Hepatology', market: 'commercial' },
    ],
    hitl: { routine: 45, complex: 35, exception: 20 },
    validation: { sampleCases: 8, reusePct: 91, timeEstimate: '~1 hour', netNew: 'CRM object field map only' },
  },
  {
    id: 'meridian-health',
    company: 'Meridian Health System',
    type: 'Integrated health system · multi-specialty',
    icon: Building2,
    blurb: 'Regional hospital network running Epic. PA spans many service lines — endocrinology, GI, hepatology — all sourced from one EHR.',
    dataStory: 'The richest-integration archetype: a live Epic FHIR feed plus the lab system (HL7) and an inbound fax line for payer letters. The FHIR adapter normalizes Epic resources into the same canonical schema ACME and Beacon use — nothing downstream changes.',
    connectorIds: ['ehr-fhir', 'lis-hl7', 'fax-ocr'],
    fieldMappings: [
      { source: 'Patient.Condition.code',           canonical: 'diagnosis',     confidence: 97 },
      { source: 'MedicationRequest.medicationCode',  canonical: 'drug',          confidence: 95 },
      { source: 'Coverage.payor.identifier',         canonical: 'plan_id',       confidence: 99 },
      { source: 'Observation.value (HL7 ORU)',       canonical: 'lab_values',    confidence: 96 },
      { source: 'fax.classified_reason',             canonical: 'denial_reason', confidence: 88 },
    ],
    policyPacks: [
      { name: 'ozempic_cigna_base',        category: 'Endocrinology',    market: 'commercial' },
      { name: 'esomeprazole_uhc_pediatric',  category: 'Gastroenterology', market: 'commercial' },
      { name: 'livdelzi_cigna_hepatology', category: 'Hepatology',        market: 'commercial' },
    ],
    hitl: { routine: 55, complex: 30, exception: 15 },
    validation: { sampleCases: 12, reusePct: 93, timeEstimate: '~2 hours', netNew: 'Epic FHIR resource map only' },
  },
]

export function ConfidencePill({ v }: { v: number }) {
  const cls = v >= 95 ? 'text-emerald-300 bg-emerald-500/10' : v >= 85 ? 'text-sky-300 bg-sky-500/10' : 'text-amber-300 bg-amber-500/10'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${cls}`}>{v}%</span>
}

// ---------------------------------------------------------------------------
// View — Onboard a New Client (the platformization wizard)
// ---------------------------------------------------------------------------

export const ONBOARD_STEPS = ['Client Profile', 'Data Sources', 'Field Mapping', 'Coverage Scope', 'Review Tiers', 'Validate & Launch']

export function OnboardingView({ setView }: { setView: (v: View) => void }) {
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [selectedConnectors, setSelectedConnectors] = useState<Set<string>>(new Set())
  const [validating, setValidating] = useState(false)
  const [validated, setValidated] = useState(false)
  const [launched, setLaunched] = useState(false)

  const template = templateId ? ONBOARDING_TEMPLATES.find(t => t.id === templateId) ?? null : null

  const pickTemplate = (id: string) => {
    const t = ONBOARDING_TEMPLATES.find(tpl => tpl.id === id)!
    setTemplateId(id)
    setSelectedConnectors(new Set(t.connectorIds))
    setValidated(false)
  }

  const toggleConnector = (id: string) => {
    setSelectedConnectors(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const runValidation = () => {
    setValidating(true)
    setTimeout(() => { setValidating(false); setValidated(true) }, 1600)
  }

  const canAdvance = stepIdx === 0 ? !!template : true

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Onboard a New Client</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Stand up a new customer by configuring reusable platform components — not by building a custom pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoleChip layer="scale" />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400">ClearAuth Implementation Team</span>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="px-8 pt-6">
        <div className="flex items-center max-w-4xl">
          {ONBOARD_STEPS.map((label, i) => {
            const done = i < stepIdx
            const current = i === stepIdx
            return (
              <Fragment key={label}>
                {i > 0 && <div className={`flex-1 h-px ${i <= stepIdx ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
                <button
                  onClick={() => i <= stepIdx && setStepIdx(i)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-semibold transition-colors ${
                    done ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
                    current ? 'bg-emerald-500 border-emerald-500 text-white' :
                    'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${current ? 'text-white' : 'text-slate-500'}`}>{label}</span>
                </button>
              </Fragment>
            )
          })}
        </div>
      </div>

      <div className="px-8 py-6">

        {/* Step 1 — Client Profile */}
        {stepIdx === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Select the client to onboard. Their profile seeds the connector defaults and policy packs.</p>
            <div className="grid grid-cols-2 gap-4">
              {ONBOARDING_TEMPLATES.map(t => {
                const Icon = t.icon
                const active = templateId === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => pickTemplate(t.id)}
                    className={`text-left p-5 rounded-xl border transition-all ${
                      active ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                        <Icon className={`w-5 h-5 ${active ? 'text-emerald-400' : 'text-slate-300'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t.company}</p>
                        <p className="text-xs text-slate-500">{t.type}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{t.blurb}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 2 — Data Sources */}
        {stepIdx === 1 && template && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">{template.dataStory}</p>
            </div>
            <p className="text-sm text-slate-400">Toggle the data sources <span className="text-slate-300 font-medium">{template.company}</span> actually has. Each connector is a reusable adapter — selecting one is configuration, not code.</p>
            <div className="grid grid-cols-1 gap-2.5">
              {CONNECTORS.map(c => {
                const Icon = c.icon
                const on = selectedConnectors.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleConnector(c.id)}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all ${
                      on ? 'bg-slate-800/70 border-slate-600' : 'bg-slate-900/40 border-slate-800 opacity-55 hover:opacity-90'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 ${CATEGORY_CLS[c.category]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{c.name}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_CLS[c.category]}`}>{c.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{c.ingests} · <span className="font-mono">{c.vendors}</span></p>
                    </div>
                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${on ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
                    </div>
                  </button>
                )
              })}
            </div>
            {!selectedConnectors.has('ehr-fhir') && (
              <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />No EHR connector enabled — {template.company} has no clinical-system integration. The platform handles this through its other adapters.
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Field Mapping */}
        {stepIdx === 2 && template && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">The adapter maps <span className="text-slate-300 font-medium">{template.company}</span>&rsquo;s source fields into the canonical ontology schema. Auto-suggested mappings shown with confidence; an implementation lead confirms low-confidence rows.</p>
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Source Field ({template.company})</th>
                    <th className="px-2 py-3"></th>
                    <th className="text-left px-4 py-3 font-medium">Canonical Schema</th>
                    <th className="text-center px-4 py-3 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {template.fieldMappings.map(m => (
                    <tr key={m.source} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400">{m.source}</td>
                      <td className="px-2 py-3 text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-600 inline" /></td>
                      <td className="px-4 py-3 font-mono text-emerald-400">{m.canonical}</td>
                      <td className="px-4 py-3 text-center"><ConfidencePill v={m.confidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-600">The canonical schema is shared across every client. Only the left column changes per customer — that&rsquo;s the entire customer-specific surface area.</p>
          </div>
        )}

        {/* Step 4 — Coverage Scope */}
        {stepIdx === 3 && template && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Declare {template.company}&rsquo;s coverage scope — the payers and drugs their patients present. ClearAuth <span className="text-slate-300">resolves</span> matching packs from the shared <button onClick={() => setView('platform')} className="text-emerald-400 hover:underline">Policy Pack Registry</button> automatically. You don&rsquo;t hand-pick packs — a patient&rsquo;s plan resolves them per case, like pharmacy claim adjudication.</p>
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Resolved from registry</p>
              {template.policyPacks.map(p => (
                <div key={p.name} className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-emerald-400">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-500">{p.category}</p>
                      <MarketBadge market={p.market} />
                    </div>
                  </div>
                  <span className="text-xs text-emerald-300 inline-flex items-center gap-1.5 shrink-0"><CheckCircle className="w-4 h-4" />Registry hit</span>
                </div>
              ))}
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide pt-2">Long tail — synthesized on first case</p>
              <div className="flex items-center gap-4 p-4 bg-violet-950/20 border border-violet-500/30 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                  <Beaker className="w-4 h-4 text-violet-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">Plans &amp; drugs not yet in the registry</p>
                  <p className="text-xs text-slate-500">Resolved on first case — synthesized from the payer&rsquo;s published policy, eval-gated, then cached for every client.</p>
                </div>
                <span className="text-xs text-violet-300 shrink-0">Auto-synthesize</span>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-400 leading-relaxed">Packs are shared and versioned. A patient&rsquo;s plan (BIN/PCN/Group + drug) resolves the applicable pack per case; when a payer updates a policy, the pack is updated once and every client inherits it.</p>
            </div>
          </div>
        )}

        {/* Step 5 — Review Tiers */}
        {stepIdx === 4 && template && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Set the human-review depth for {template.company}. Tier routing is deterministic — confidence and rule checks only, never an LLM deciding its own oversight. A human reviews every case; the depth scales with complexity.</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { tier: 'Routine',   pct: template.hitl.routine,   cls: 'text-emerald-300', bar: 'bg-emerald-500', note: '~3 min · summary review' },
                { tier: 'Complex',   pct: template.hitl.complex,   cls: 'text-amber-300',   bar: 'bg-amber-500',   note: '~10 min · full letter' },
                { tier: 'Exception', pct: template.hitl.exception, cls: 'text-red-300',     bar: 'bg-red-500',     note: 'Investigation required' },
              ].map(t => (
                <div key={t.tier} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-bold font-mono ${t.cls}`}>{t.pct}%</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-700">
                    <div className={`h-1 rounded-full ${t.bar}`} style={{ width: `${t.pct}%` }} />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">{t.tier}</p>
                  <p className="text-xs text-slate-500">{t.note}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600">Projected case mix based on {template.company}&rsquo;s drug portfolio and payer set. Specialty drugs skew toward complex/exception; high-volume routine drugs skew toward routine.</p>

            <div className="pt-2">
              <p className="text-sm text-slate-400 mb-3">
                ClearAuth sets a sensible default here at go-live; <span className="text-slate-300">{template.company} owns this policy</span> and
                tunes it day-to-day in their own workspace (<button onClick={() => setView('automation')} className="text-teal-400 hover:underline">Operate → Automation Policy</button>).
                Shown read-only below — how much routine volume to auto-assemble vs. review in depth.
              </p>
              <ReviewPolicyControl routineVolumePct={template.hitl.routine} readOnly />
            </div>
          </div>
        )}

        {/* Step 6 — Validate & Launch */}
        {stepIdx === 5 && template && (
          <div className="space-y-5">
            {!validated ? (
              <>
                <p className="text-sm text-slate-400">Before go-live, run the shared eval suite against {template.validation.sampleCases} sample cases through {template.company}&rsquo;s full configuration — connectors → field mappings → resolved packs → review tiers → gatekeeper. It&rsquo;s scored by the same <button onClick={() => setView('rubric')} className="text-emerald-400 hover:underline">Eval Rubric</button> the AI Lead governs in Build; the gate is identical for every client.</p>
                <button
                  onClick={runValidation}
                  disabled={validating}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
                  {validating ? 'Running eval suite…' : `Run validation (${template.validation.sampleCases} sample cases)`}
                </button>
              </>
            ) : launched ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Rocket className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-emerald-400">{template.company} is Live</h2>
                    <p className="text-sm text-emerald-300/70">Configured and deployed on the shared platform.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setView('platform')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                    <Boxes className="w-4 h-4" />View Platform Registry
                  </button>
                  <button onClick={() => setView('portfolio')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <ChevronRight className="w-4 h-4" />Go to Case Queue
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Gate result header */}
                <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-emerald-300">Cleared the Launch Gate</h2>
                    <p className="text-xs text-emerald-300/70">{template.validation.sampleCases}/{template.validation.sampleCases} sample cases passed every dimension of the shared Eval Rubric — the same gate the AI Lead governs in Build, not a separate onboarding check.</p>
                  </div>
                </div>

                {/* Eval gate — per-dimension result vs. the AI-Lead-owned thresholds */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <Workflow className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">Eval Gate · shared rubric</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <IllustrativeTag />
                      <button onClick={() => setView('rubric')} className="text-xs text-emerald-400 hover:underline whitespace-nowrap">View Eval Rubric →</button>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                        <th className="text-left px-4 py-2.5 font-medium">Dimension</th>
                        <th className="text-left px-4 py-2.5 font-medium">Method</th>
                        <th className="text-center px-4 py-2.5 font-medium">Required</th>
                        <th className="text-center px-4 py-2.5 font-medium">Result</th>
                        <th className="text-center px-4 py-2.5 font-medium">Gate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {RUBRIC_DIMENSIONS.map(d => {
                        const score = Math.min(1, d.threshold + 0.04)
                        return (
                          <tr key={d.dimension} className="hover:bg-slate-700/20 transition-colors">
                            <td className="px-4 py-2.5 text-slate-300">{d.dimension}</td>
                            <td className="px-4 py-2.5 text-slate-500">{METHOD_LABEL[d.method]}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-400">{thresholdLabel(d.threshold)}</td>
                            <td className="px-4 py-2.5 text-center font-mono text-emerald-300">{Math.round(score * 100)}%</td>
                            <td className="px-4 py-2.5 text-center"><CheckCircle className="w-4 h-4 text-emerald-400 inline" /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="px-4 py-2.5 text-[11px] text-slate-600 border-t border-slate-700/40">
                    Thresholds are authored by the AI Lead in the Eval Rubric (Build layer) — onboarding runs that gate, it doesn&rsquo;t define its own.
                  </p>
                </div>

                {/* Platform economics — one coherent story: configuration, not code */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Net-New Code', value: '0 lines', sub: `${template.company} is stood up by configuration, not code — no bespoke pipeline.` },
                    { label: 'Configuration Split', value: `${template.validation.reusePct}% / ${100 - template.validation.reusePct}%`, sub: `${template.validation.reusePct}% shared platform components · ${100 - template.validation.reusePct}% client-specific — ${template.validation.netNew}. The client-specific part is declarative field mappings, not code.` },
                    { label: 'Setup Time', value: template.validation.timeEstimate, sub: 'configuration vs. a multi-week custom build (illustrative)' },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                      <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
                      <p className="text-2xl font-bold font-mono text-emerald-300 leading-none">{m.value}</p>
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.sub}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => setLaunched(true)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                  <Rocket className="w-4 h-4" />Launch {template.company}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wizard nav */}
        {!launched && (
          <div className="flex gap-3 pt-8 mt-2 border-t border-slate-800">
            {stepIdx > 0 && (
              <button onClick={() => setStepIdx(stepIdx - 1)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                <ChevronLeft className="w-4 h-4" />Back
              </button>
            )}
            {stepIdx < ONBOARD_STEPS.length - 1 && (
              <button
                onClick={() => canAdvance && setStepIdx(stepIdx + 1)}
                disabled={!canAdvance}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors ml-auto"
              >
                Next<ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View — Platform Registry (the centralized system of reusable components)
// ---------------------------------------------------------------------------
