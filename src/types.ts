export type View = 'landing' | 'portfolio' | 'poc' | 'library' | 'evals' | 'onboarding' | 'platform' | 'failures' | 'specs' | 'instructions' | 'rubric' | 'sponsor' | 'automation'
export type Role = 'Operate' | 'Build' | 'Scale' | 'Sponsor'
export type IntakePhase = 'upload' | 'analyzing' | 'extracted'
export type ClientType = 'medtech' | 'patient'
export type RuleType = 'diagnostic' | 'temporal' | 'math' | 'safety' | 'provider' | 'quantity' | 'custom'
export type SimPhase = 'idle' | 'loading' | 'done' | 'review' | 'submitted' | 'round2_loading' | 'round2_done' | 'round2_submitted'
export type CriterionStatus = 'found' | 'needs_review' | 'conflict'
export type CaseStatus = 'processing' | 'ready_for_review' | 'exception' | 'submitted' | 'payer_response'
// Lifecycle stage a case represents. 'initial_pa' = assemble & transmit a new
// prior-auth request (Da Vinci CRD → DTR → PAS). 'appeal' = contest a prior
// denial. Absent on a scenario ⇒ 'appeal' (the original demo scenarios).
export type CaseLifecycle = 'initial_pa' | 'appeal'

export interface Rule {
  type: RuleType
  label: string
}

export interface WorkflowPlan {
  action: string
  recipient: string
  channel: string
  turnaround: string
}

export interface CriterionResult {
  rule: Rule
  status: CriterionStatus
  note: string
  docSource: string
  suggestedAction?: string
  workflowPlan?: WorkflowPlan
  // For status 'conflict': the two (or more) contradictory source claims the
  // system surfaces instead of silently selecting one.
  conflictSources?: { source: string; claim: string }[]
}

export interface TimelineEvent {
  label: string
  date: string
  note?: string
  status: 'done' | 'flagged' | 'pending'
}

export interface ScenarioConfig {
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
  // ── Initial-PA lifecycle (lifecycle === 'initial_pa') ─────────────────────
  // Absent ⇒ this is an appeal scenario and the fields below do not apply.
  lifecycle?: CaseLifecycle
  // CRD pre-check: is a PA required for this drug × plan, and on what basis?
  paRequired?: { required: boolean; basis: string }
  // The therapy the structured PA request asks the payer to authorize.
  requestedTherapy?: string
  // Payer determination after the PAS submission. 'approved' is the happy path;
  // 'denied' hands off to the appeal flow (Workstream A-T2).
  paOutcome?: {
    decision: 'approved' | 'pended' | 'denied'
    determinationId: string
    timeToTherapy: string   // headline KPI — filing → approval turnaround
    note: string
  }
  // Initial-PA denial → appeal handoff: which appeal scenario the "Start appeal"
  // action launches, and the case reference it continues under. Closes the loop
  // back onto the existing appeal flow on the same patient/case.
  appealHandoff?: { scenarioId: string; caseRef: string }
  // Case timeline + AI response analysis
  timeline?: TimelineEvent[]
  payerResponseAnalysis?: {
    responseType: 'partial_approval' | 'full_denial' | 'full_approval' | 'info_request'
    aiFlag: string
    aiRationale: string
    ctaAccept: string
    ctaDispute: string
  }
}

// How close a case is to its regulatory turnaround deadline — drives queue
// prioritization (sort + color), since PA has standard/expedited decision clocks.
// All tiers are pre-deadline: the platform's job is to surface cases in time, so a
// missed deadline (after which a payer won't honor the PA/appeal) isn't a queue
// state — it would close the case unfavorably, not sit here as "actionable".
export type Urgency = 'today' | 'soon' | 'later'

export interface Client {
  id: number
  name: string
  drug: string
  categoryLabel: string
  status: CaseStatus
  clientType: ClientType
  lastUpdated: string
  scenarioId: string
  deadline: string   // human label, e.g. 'Due today', 'Overdue · 1d', 'Due in 4 days'
  urgency: Urgency
}

// ---------------------------------------------------------------------------
// Layer 1 — Universal Rule Primitives
// ---------------------------------------------------------------------------

export interface UniversalPrimitive {
  type: RuleType
  schemaClass: string
  name: string
  description: string
  params: string[]
  isNew?: boolean
  version?: number   // schema version of this primitive; bumps on an edit
}

export type CaseTier = 'routine' | 'complex' | 'exception'

export type IconType = React.ComponentType<{ className?: string }>

// ---------------------------------------------------------------------------
// Eval methodology suite + run results — Build layer
// ---------------------------------------------------------------------------

// A deep-link from a failure to the real case/scenario that exhibits it.
export interface CaseLink {
  scenarioId: string
  status: CaseStatus
  caseName: string          // e.g. "Case #PH-4201 · Esomeprazole"
}

// The evaluation methods that score the system (not competitors — they each
// measure a different facet and all run together). These are *methods*, ordered
// by how much subjective judgment the scorer exercises:
//   Deterministic  — rule-based, no model
//   RAGAS          — model-graded NLI / claim verification (low subjectivity)
//   LLM-as-judge   — graded against authored rubric criteria (subjective)
//   Red-team       — adversarial probes
export type EvalMethodology = 'Deterministic' | 'RAGAS' | 'LLM-as-judge' | 'Red-team'

export interface MetricResult {
  methodology: EvalMethodology
  grader: string            // e.g. "FaithfulnessMetric"
  method: string            // e.g. "LLM-as-judge (RAG)", "Deterministic"
  score: number             // 0–1
  threshold: number         // 0–1
  passed: boolean
  reason?: string           // grader explanation, undefined for trivial passes
  caseLink?: CaseLink       // for a failing metric: the real case it points to
}

export interface CaseEvalResult {
  caseId: string
  tier: CaseTier
  metrics: MetricResult[]
  overallPassed: boolean
}

// Red-team / adversarial probes evaluate the system holistically (not per-case):
// crafted attacks run against the pipeline, scored by how many are blocked.
export interface RedTeamProbe {
  category: string          // 'PHI Leak' | 'Prompt Injection' | 'Jailbreak'
  attack: string            // one-line description of the attack
  probes: number            // attacks attempted
  blocked: number           // attacks the system withstood
  passRate: number          // blocked / probes, 0–1
  reason?: string           // detail for a category that did not fully pass
  caseLink?: CaseLink       // the real case the near-miss relates to
}

// ---------------------------------------------------------------------------
// Runtime profile — cost / latency / model routing for the pipeline. These are
// READ FROM LANGFUSE traces (latency percentiles, token usage, cost = tokens ×
// model pricing), not recomputed in-app. The in-app strip is the decision view;
// deep trace waterfalls + per-model breakdowns live in Langfuse.
// ---------------------------------------------------------------------------
export interface NodeRuntime {
  node: string              // 'Ingestion' | 'Retrieval' | 'Synthesis' | 'Gatekeeper'
  model: string             // model id, or 'deterministic · no model'
  rationale: string         // why this model is routed here (cost/quality tradeoff)
  p50Ms: number
  p95Ms: number
  costUsd: number           // per-case contribution
  tokens: number            // per-case tokens (0 for deterministic)
}

export interface RuntimeProfile {
  tracedIn: string          // observability platform the figures are read from
  costPerCaseUsd: number    // end-to-end, sums the nodes
  p50Ms: number             // end-to-end wall-clock
  p95Ms: number
  tokensPerCase: number
  nodes: NodeRuntime[]
  note: string              // attribution — where the numbers come from / live in full
}

export interface EvalRun {
  runId: string
  timestamp: string
  platform: string          // where the run executed, e.g. "Langfuse (self-hosted)"
  durationSeconds: number
  suiteSize: number         // full regression suite size (results[] shows a subset)
  results: CaseEvalResult[]
  redTeam: RedTeamProbe[]
  runtime: RuntimeProfile
}
