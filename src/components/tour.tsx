import { type Step } from 'react-joyride'
import { type CaseStatus, type View } from '../types'

export const tc = (body: string, note?: string) => (
  <div>
    <p style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{body}</p>
    {note && <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 8, marginBottom: 0 }}>{note}</p>}
  </div>
)

export const tl = (items: string[], note?: string) => (
  <div>
    <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.5, color: '#cbd5e1' }}>
          <span style={{ color: '#6d28d9', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
    {note && <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, marginTop: 10, marginBottom: 0 }}>{note}</p>}
  </div>
)

// ---------------------------------------------------------------------------
// Audience tours. The single 22-step monolith is split into self-contained
// tours, one per lens (Operate / Build / Scale) plus a 90-second overview.
// Each step carries a `nav` describing which view (and case) must be active when
// it shows — the App driver applies it before advancing, so there is no per-index
// hard-coding. A `body` / center step with no `nav` runs on the current view.
// ---------------------------------------------------------------------------

export interface TourNav { view: View; scenarioId?: string; caseStatus?: CaseStatus }
export type TourStep = Step & { nav?: TourNav }
export type TourId = 'operate' | 'build' | 'scale' | 'overview'

// ── Operate — the client/coordinator teaser (tight; "know your why") ─────────
const OPERATE_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Operate — the coordinator’s day',
    content: tc(
      'A PA Coordinator arrives to work the AI has already done. This is the queue of in-flight prior-authorization cases — you review and authorize, you don’t research each one from scratch.',
      'Arrows to navigate · Esc to exit'
    ),
  },
  {
    target: '#tour-portfolio-list', placement: 'right', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'One queue, the whole lifecycle',
    content: tl([
      'Stage — Initial PA (a new request) or Appeal (contesting a denial).',
      'Status — where the case sits: ready to review, payer responded, exception.',
      'Review Tier — how much oversight it gets: Routine, Complex, or Exception.',
    ], 'Human review at every tier — the depth scales with complexity, not the presence of a human.'),
  },
  {
    target: '#tour-case-initial-pa', placement: 'right', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Front of the lifecycle — an initial PA',
    content: tc(
      'A new Ozempic prior-authorization, assembled from the patient’s chart and ready to file. Initial PAs are the high-volume base of the lifecycle.',
      'Next: open it and see what the pipeline built.'
    ),
  },
  {
    target: '#tour-pipeline-header', placement: 'bottom', skipBeacon: true, nav: { view: 'poc', scenarioId: 'novo-ozempic-initial', caseStatus: 'ready_for_review' },
    title: 'The pipeline assembled the request',
    content: tc(
      'The same 4-node engine — Ingestion → Retrieval → Synthesis → Gatekeeper — framed here as the Da Vinci CRD → DTR → PAS lifecycle. It produced a structured PA request: completed questionnaire plus a FHIR (X12 278) bundle.'
    ),
  },
  {
    target: '#tour-criteria-audit', placement: 'top', skipBeacon: true, nav: { view: 'poc', scenarioId: 'novo-ozempic-initial', caseStatus: 'ready_for_review' },
    title: 'Every answer maps to a source',
    content: tc(
      'Each PA criterion is bound to a document and page in the chart. No answer exists without a citation the coordinator can verify before filing.'
    ),
  },
  {
    target: '#tour-review-btn', placement: 'top', skipBeacon: true, nav: { view: 'poc', scenarioId: 'novo-ozempic-initial', caseStatus: 'ready_for_review' },
    title: 'The human is the final gate',
    content: tc(
      'You review, then authorize. Nothing transmits to the payer until a person approves — for every case, every tier. Approved initial PAs file via PAS; a denial flips to an appeal on the same evidence; an exception escalates to a person.',
      'That’s Operate. The Build tour shows the layer the Applied AI Lead owns.'
    ),
  },
]

// ── Build — the Applied AI Lead layer (the emphasis tour) ────────────────────
const BUILD_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Build — the layer you own as Applied AI Lead',
    content: tc(
      'Everything in Operate was the surface the client touches. This is the layer this role owns: where probabilistic model behavior is governed like code — observed, fixed, evaluated, and rolled out safely.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Failure Review — fix the cluster, not the case',
    content: tl([
      'Failures sampled from prod are grouped by mode and prioritized by severity × volume — 3 safety failures outrank 50 over-cautious ones.',
      'You remediate the cluster: one bounded fix resolves the whole group.',
      'Every fix is sandbox-tested against the full eval suite before it reaches prod.',
    ], 'Open a cluster to analyze its root cause and fix it in-context.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'instructions' },
    title: 'Agent Instructions — versioned & gated',
    content: tl([
      'Per-node instruction sets: role, inputs, task, output contract, guardrails.',
      'Edits run in a sandbox against the full eval suite; promotion is blocked on any regression.',
      'Same source of truth whether edited here or from a failure cluster.',
    ], 'Probabilistic model behavior, governed like code.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'rubric' },
    title: 'Eval Rubric — what "good" means, authored',
    content: tl([
      'Per-dimension thresholds you author: deterministic safety gate, claim-citation faithfulness, guideline coverage, clinical argument, tone, medical safety.',
      'The LLM-as-judge dimensions are calibrated against a clinician panel — a human owns the ambiguous tail.',
      'This is the same gate every onboarding validation runs — one source of truth.',
    ], 'Change the rubric and the whole system is re-graded against it.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'specs' },
    title: 'Workflow Specs — one per policy pack',
    content: tl([
      'Each drug × payer pack has its own spec: decision rules, edge cases, escalation, review depth.',
      'All composed from the four shared rule primitives — only the rules and thresholds differ per pack.',
      'Every spec is versioned and sandbox-gated before promotion.',
    ], 'How messy payer policy becomes reliable, testable system behavior.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'library' },
    title: 'Ontology Library — the shared primitives',
    content: tl([
      'A small set of universal rule primitives — diagnostic, biomarker/math, temporal, safety, provider, dose/quantity.',
      'Every policy pack is composed from these; nothing is bespoke per case.',
      'The appeal skeleton and the structured PA request are both built from the same ontology.',
    ], 'The vocabulary the whole system is written in.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Staged rollout — nothing ships unproven',
    content: tc(
      'A fix or instruction edit moves prod → sandbox → eval suite → canary → full rollout. Promotion is blocked on any regression against the rubric. The probabilistic layer ships with the same discipline as application code.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'That’s the Build layer',
    content: tc(
      'Observe failures → remediate clusters → govern with instructions + rubric → gate and roll out. Probabilistic behavior, versioned, eval-gated, and audited.',
      'The Scale tour shows how this becomes a platform across many clients.'
    ),
  },
]

// ── Scale — the platform / reuse economics (VC / exec) ───────────────────────
const SCALE_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Scale — configuration, not custom builds',
    content: tc(
      'Onboarding a new client doesn’t mean building a new pipeline. It means configuring reusable platform components — connectors, field mappings, coverage scope, review tiers — then validating against the shared gate.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Onboarding as a wizard',
    content: tl([
      'Pick the client archetype; connectors and policy packs seed from it.',
      'Map the client’s source fields into one canonical schema — the only client-specific surface.',
      'Coverage scope resolves shared packs automatically; misses synthesize on first case.',
    ], 'Walk the wizard from the sidebar to see each step.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Validate against the same gate',
    content: tl([
      'Sample cases run through the full config and are scored by the AI-Lead-owned Eval Rubric.',
      '0 lines of net-new code — the client-specific surface is declarative field mappings.',
      '~94% shared platform components; the rest is the client’s mapping adapter.',
    ], 'The launch gate is identical for every client.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'Platform Registry — reuse across clients',
    content: tl([
      'Connectors, canonical schema, prompts, evals, and the engine are shared across every deployment.',
      'A policy pack updated once propagates to every client that resolves it.',
      'The only client-specific layer is the data connectors + field mapping.',
    ], 'This is what turns bespoke customer builds into a platform.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'That’s the Scale story',
    content: tc(
      'Shared components + onboarding-as-configuration + a single eval gate = each new client compounds the platform instead of forking it.',
      'Explore any section from the sidebar.'
    ),
  },
]

// ── Overview — the 90-second arc (3–4 top beats) ─────────────────────────────
const OVERVIEW_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'ClearAuth in 90 seconds',
    content: tc(
      'An AI-native prior-authorization platform across the full PA lifecycle. Three layers — Operate, Build, Scale. Here’s the arc.',
      'Arrows to navigate · Esc to exit'
    ),
  },
  {
    target: '#tour-portfolio-list', placement: 'right', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Operate — run the work',
    content: tc(
      'A coordinator works a queue of cases the AI already assembled — initial PAs and appeals, routed to a review tier. A human authorizes every send.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Build — govern the model',
    content: tc(
      'The Applied AI Lead owns this layer: cluster prod failures, author instructions and the eval rubric, and gate every change with the eval suite. Probabilistic behavior, governed like code.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'Scale — make it a platform',
    content: tc(
      'New clients are configuration, not custom builds: shared connectors, schema, packs, and one eval gate. Each client compounds the platform.',
      'Pick a focused tour from the welcome screen, or explore from the sidebar.'
    ),
  },
]

export type TourAccent = 'violet' | 'purple' | 'fuchsia' | 'slate'

export interface TourMeta {
  id: TourId
  label: string
  audience: string
  blurb: string
  accent: TourAccent
  steps: TourStep[]
}

export const TOURS: Record<TourId, TourMeta> = {
  build: {
    id: 'build', label: 'Build', audience: 'Evaluating the AI Lead', accent: 'violet',
    blurb: 'The layer this role owns — failure clusters, agent instructions, the eval rubric, and staged rollout. How probabilistic model behavior gets governed like code.',
    steps: BUILD_TOUR,
  },
  operate: {
    id: 'operate', label: 'Operate', audience: 'A prospective client', accent: 'purple',
    blurb: 'A coordinator’s day: one queue across the PA lifecycle, three review tiers, and the human authorization gate. Initial PA → file; denial → appeal.',
    steps: OPERATE_TOUR,
  },
  scale: {
    id: 'scale', label: 'Scale', audience: 'An investor or exec', accent: 'fuchsia',
    blurb: 'Why this is a platform, not a custom build: onboarding as configuration, a shared component registry, and the reuse economics.',
    steps: SCALE_TOUR,
  },
  overview: {
    id: 'overview', label: '90-second overview', audience: 'Just exploring', accent: 'slate',
    blurb: 'The whole arc in four beats — Operate, Build, Scale — in about 90 seconds.',
    steps: OVERVIEW_TOUR,
  },
}

export const JOYRIDE_STYLES: import('react-joyride').PartialDeep<import('react-joyride').Styles> = {
  tooltip: {
    borderRadius: 12,
    backgroundColor: '#0f172a',
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
    backgroundColor: '#4c1d95',
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
