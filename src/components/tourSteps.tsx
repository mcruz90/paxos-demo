import { type Step } from 'react-joyride'
import { type CaseStatus, type Role, type View } from '../types'

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

export interface TourNav { view: View; scenarioId?: string; caseStatus?: CaseStatus }
export type TourStep = Step & { nav?: TourNav }
export type TourId = 'operate' | 'build' | 'scale' | 'overview'

const OPERATE_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Operate — the PA coordinator’s workqueue',
    content: tc(
      'Clinical staff land in an Epic-grounded workqueue sorted by action urgency and Part D / Commercial Rx and CMS statutory SLA clocks — never researching cases from scratch.',
      'Arrows to navigate · Esc to exit'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Action groups & statutory SLA clocks',
    content: tl([
      'Needs investigation — missing docs or conflicting chart evidence.',
      'Respond to payer — partial approvals / counter-offers ready to dispute.',
      'Review & approve — criteria ready for human packet review.',
    ], 'Click any row to open the patient chart.'),
  },
  {
    target: '#tour-workqueue-ribbon', placement: 'bottom', skipBeacon: true, nav: { view: 'portfolio', scenarioId: 'novo-ozempic-initial' },
    title: 'Bird’s-eye workqueue ribbon',
    content: tc(
      'Stay oriented across the entire roster while working inside a patient chart — switch patients in one click or jump back to the Full Workqueue.'
    ),
  },
  {
    target: '#tour-epic-storyboard', placement: 'right', skipBeacon: true, nav: { view: 'portfolio', scenarioId: 'novo-ozempic-initial' },
    title: 'Persistent Epic Patient Storyboard',
    content: tc(
      'Demographics, plan ID, statutory SLA clock, active ICD-10 problems, step-therapy trials, and PA history stay anchored on the left.'
    ),
  },
  {
    target: '#tour-criteria-checklist', placement: 'right', skipBeacon: true, nav: { view: 'portfolio', scenarioId: 'novo-ozempic-initial' },
    title: 'Every criterion traced to citations',
    content: tc(
      'Unresolved safety contradictions and gaps bubble to the top; clicking any criterion highlights the matching source excerpt on the right.'
    ),
  },
  {
    target: '#tour-packet-tab', placement: 'bottom', skipBeacon: true, nav: { view: 'portfolio', scenarioId: 'novo-ozempic-initial' },
    title: 'Human sign-off gates every transmission',
    content: tc(
      'Open 2. PA Packet to verify inline citations or draft edits before filing via Da Vinci PAS (X12 278). Nothing transmits without human approval.',
      'Next: explore the Build tour to see the Technical Clinician & Evals Inspector.'
    ),
  },
]

const BUILD_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'inspector' },
    title: 'Build — Technical & Evals Inspector',
    content: tc(
      'Everything in Operate stays pure clinical. Technical clinicians and Applied AI Leads work here in a PII-tokenized control plane — inspecting tokenized spans, eval harness (clearauth-eval) checks, and SSE audit records.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Failure Review — fix the cluster, not the case',
    content: tl([
      'Failures sampled from prod are grouped by mode and prioritized by severity × volume.',
      'You remediate the cluster: one bounded fix resolves the whole group.',
      'Every fix is sandbox-tested against the full eval suite before it reaches prod.',
    ], 'Open a cluster to analyze its root cause and fix it in-context.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'instructions' },
    title: 'Agent Instructions — versioned & gated',
    content: tl([
      'Per-node instruction sets: role, inputs, task, output contract, guardrails.',
      'Edits run in a sandbox against the full eval suite; promotion is blocked on regression.',
      'Same source of truth whether edited here or from a failure cluster.',
    ], 'Probabilistic model behavior, governed like code.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'rubric' },
    title: 'Eval Rubric — what "good" means, authored',
    content: tl([
      'Deterministic safety/structure checks (D1–D7) and the claim-citation gate (E1–E2).',
      'Defined ordinal judge criteria (J1–J4) remain advisory until clinician calibration completes.',
      'Same gate every onboarding validation runs — one source of truth.',
    ], 'Change the rubric and the whole system is re-graded against it.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'specs' },
    title: 'Workflow Specs — one per policy pack',
    content: tl([
      'Each drug × payer pack has its own spec: decision rules, edge cases, escalation, review depth.',
      'Composed from shared rule primitives — only rules and thresholds differ per pack.',
      'Every spec is versioned and sandbox-gated before promotion.',
    ], 'How payer policy becomes testable system behavior.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'library' },
    title: 'Ontology Library — the shared primitives',
    content: tl([
      'Universal rule primitives — diagnostic, biomarker/math, temporal, safety, provider, dose/quantity.',
      'Every policy pack is composed from these shared primitives.',
      'Appeal and initial PA packets are built from the same ontology.',
    ], 'The vocabulary the whole system is written in.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Staged rollout — nothing ships unproven',
    content: tc(
      'A fix moves prod → sandbox → eval suite → canary → full rollout. Promotion is blocked on any regression against the rubric.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'That’s the Build layer',
    content: tc(
      'Observe failures → remediate clusters → govern with instructions + rubric → gate and roll out.',
      'The Scale tour shows how this becomes a platform across many clients.'
    ),
  },
]

const SCALE_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Scale — configuration, not custom builds',
    content: tc(
      'Onboarding a new client configures reusable platform components — connectors, field mappings, coverage scope, review tiers — validated against the shared gate.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Onboarding as a wizard',
    content: tl([
      'Pick the client archetype; connectors and policy packs seed from it.',
      'Map source fields into one canonical schema.',
      'Coverage scope resolves shared packs automatically.',
    ], 'Walk the wizard from the sidebar to see each step.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'onboarding' },
    title: 'Validate against the same gate',
    content: tl([
      'Sample cases run through the config and are scored by the Eval Rubric.',
      'Declarative field mappings rather than net-new pipeline branches.',
      'Identical launch gate for every client.',
    ], 'The launch gate is identical for every client.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'Platform Registry — reuse across clients',
    content: tl([
      'Connectors, canonical schema, prompts, evals, and engine are shared.',
      'Policy pack updates propagate to every client that resolves them.',
      'Client-specific customization stays in connectors + field mappings.',
    ], 'Shared architecture across deployments.'),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'That’s the Scale story',
    content: tc(
      'Shared components + configuration + a single eval gate across deployments.',
      'Explore any section from the sidebar.'
    ),
  },
]

const OVERVIEW_TOUR: TourStep[] = [
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'ClearAuth in 90 seconds',
    content: tc(
      'A prior-authorization workflow across Operate, Build, and Scale. Here’s the arc.',
      'Arrows to navigate · Esc to exit'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'portfolio' },
    title: 'Operate — run the work',
    content: tc(
      'A coordinator works an Epic-grounded queue of initial PAs and appeals ordered by statutory SLA clocks. A human authorizes every send.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'failures' },
    title: 'Build — govern the model',
    content: tc(
      'The Applied AI Lead clusters prod failures, authors instructions and the eval rubric, and gates changes with the eval suite.'
    ),
  },
  {
    target: 'body', placement: 'center', skipBeacon: true, nav: { view: 'platform' },
    title: 'Scale — make it a platform',
    content: tc(
      'New clients are configuration, not custom builds: shared connectors, schema, packs, and one eval gate.',
      'Pick a focused tour from the welcome screen, or explore from the sidebar.'
    ),
  },
]

export type TourAccent = 'violet' | 'purple' | 'fuchsia' | 'slate' | 'teal'
export interface TourMeta { id: TourId; label: string; audience: string; blurb: string; accent: TourAccent; steps: TourStep[] }

export const TOURS: Record<TourId, TourMeta> = {
  build: {
    id: 'build', label: 'Build', audience: 'Evaluating the AI Lead', accent: 'violet',
    blurb: 'Failure clusters, agent instructions, the eval rubric, and staged rollout.', steps: BUILD_TOUR,
  },
  operate: {
    id: 'operate', label: 'Operate', audience: 'A prospective client', accent: 'teal',
    blurb: 'A coordinator’s day: one queue across the PA lifecycle, three review tiers, and human authorization.', steps: OPERATE_TOUR,
  },
  scale: {
    id: 'scale', label: 'Scale', audience: 'An investor or exec', accent: 'violet',
    blurb: 'Onboarding as configuration, a shared component registry, and platform reuse.', steps: SCALE_TOUR,
  },
  overview: {
    id: 'overview', label: '90-second overview', audience: 'Just exploring', accent: 'slate',
    blurb: 'Operate, Build, and Scale in about 90 seconds.', steps: OVERVIEW_TOUR,
  },
}

export const TOUR_ROLE: Record<string, Role> = {
  operate: 'Operate', build: 'Build', scale: 'Scale', overview: 'Operate',
}
