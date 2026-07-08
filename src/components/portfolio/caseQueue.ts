import { type CaseStatus, type Client, type CriterionResult, type ScenarioConfig, type Urgency } from '../../types'
import { getCaseStage } from '../../data/scenarios'

// ---------------------------------------------------------------------------
// Case queue logic — pure functions behind SplitPortfolioView. No React, no
// component state: everything here is unit-testable with literal inputs.
// ---------------------------------------------------------------------------

// Coordinator actions taken on a case's criteria before the case leaves the
// queue view: workflows dispatched, findings overridden with a rationale, and
// the in-progress dispatch/override UI state. Local to the session (demo).
export interface LocalCaseState {
  dispatched: string[]
  pendingDispatch: string[]
  overrides: Record<string, string>
  pendingOverride: string | null
  overrideInput: string
}

export const EMPTY_LOCAL_CASE_STATE: LocalCaseState = {
  dispatched: [],
  pendingDispatch: [],
  overrides: {},
  pendingOverride: null,
  overrideInput: '',
}

export const ACTION_GROUPS: { status: CaseStatus; label: string; hint: string }[] = [
  { status: 'exception',              label: 'Needs investigation',    hint: 'Missing clinical information — review and resolve' },
  { status: 'payer_response',         label: 'Respond to payer',       hint: 'Counter-offer received — review and file the next round' },
  { status: 'ready_for_review',       label: 'Review & approve',       hint: 'AI work complete — review and authorize the send' },
  { status: 'awaiting_documentation', label: 'Awaiting documentation', hint: 'Document request sent — waiting for provider response' },
  { status: 'submitted',              label: 'Awaiting payer',         hint: 'Filed — no action needed until the payer responds' },
  { status: 'processing',             label: 'Importing from Epic',    hint: 'Syncing from the connected record' },
]

const URGENCY_ORDER: Record<Urgency, number> = { today: 0, soon: 1, later: 2 }

export type StageFilter   = 'all' | 'initial_pa' | 'appeal'
export type UrgencyFilter = 'all' | 'today' | 'soon'

const ACTIONABLE_STATUSES: CaseStatus[] = ['ready_for_review', 'exception', 'payer_response']

export function countActionable(clients: Client[]): number {
  return clients.filter(c => ACTIONABLE_STATUSES.includes(c.status)).length
}

export function filterClients(
  clients: Client[],
  search: string,
  stage: StageFilter,
  urgency: UrgencyFilter,
): Client[] {
  const q = search.toLowerCase()
  return clients.filter(c => {
    const haystack = [c.patientDisplayName, c.name, c.drug, c.categoryLabel, c.payer, c.gapSummary]
      .filter(Boolean).join(' ').toLowerCase()
    if (q && !haystack.includes(q)) return false
    if (stage !== 'all' && getCaseStage(c) !== (stage === 'initial_pa' ? 'Initial PA' : 'Appeal')) return false
    if (urgency !== 'all' && c.urgency !== urgency) return false
    return true
  })
}

// Groups the (already filtered) queue by action type, most urgent first within
// each group; groups with no cases are dropped.
export function groupByAction(clients: Client[]) {
  return ACTION_GROUPS
    .map(g => ({
      ...g,
      rows: [...clients.filter(c => c.status === g.status)]
        .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]),
    }))
    .filter(g => g.rows.length > 0)
}

// ---------------------------------------------------------------------------
// Exception resolution — a criterion not 'found' counts as resolved once the
// coordinator has either dispatched its outbound workflow or overridden the
// finding with a clinical rationale.
// ---------------------------------------------------------------------------

export function unresolvedCriteria(scenario: ScenarioConfig): CriterionResult[] {
  return scenario.criteriaResults.filter(c => c.status !== 'found')
}

export function countLocallyResolved(criteria: CriterionResult[], local: LocalCaseState): number {
  return criteria.filter(c =>
    local.dispatched.includes(c.rule.label) || local.overrides[c.rule.label] !== undefined
  ).length
}

// True only when the case actually had exceptions and every one is resolved —
// a case with nothing to resolve is not "resolved", it never needed work.
export function allExceptionsResolved(scenario: ScenarioConfig, local: LocalCaseState): boolean {
  const unresolved = unresolvedCriteria(scenario)
  return unresolved.length > 0 && countLocallyResolved(unresolved, local) === unresolved.length
}

// Where a fully resolved exception case goes next: any dispatched workflow
// means we are waiting on a provider response; overrides alone make the case
// ready for review — resolution never skips the human approval gate that
// authorizes the send (05-state-lifecycle: exception → ready_for_review).
export function statusAfterResolution(local: LocalCaseState): CaseStatus {
  return local.dispatched.length > 0 ? 'awaiting_documentation' : 'ready_for_review'
}

// ---------------------------------------------------------------------------
// Case status transitions — guarded on the current status so a stale click
// (case already moved on) is a no-op rather than an illegal jump.
// ---------------------------------------------------------------------------

export function setClientStatus(clients: Client[], scenarioId: string, status: CaseStatus): Client[] {
  return clients.map(c => (c.scenarioId === scenarioId ? { ...c, status } : c))
}

function transition(clients: Client[], scenarioId: string, from: CaseStatus, to: CaseStatus): Client[] {
  return clients.map(c =>
    c.scenarioId === scenarioId && c.status === from ? { ...c, status: to } : c
  )
}

// Quick-approve from the preview pane: coordinator trusts the AI summary and
// submits without opening the full letter review.
export function quickApproveClient(clients: Client[], scenarioId: string): Client[] {
  return transition(clients, scenarioId, 'ready_for_review', 'submitted')
}

// Inline payer-response decision. Accept → submitted (authorization accepted,
// therapy proceeds). Dispute → ready_for_review to file the next round.
export function applyPayerDecision(
  clients: Client[],
  scenarioId: string,
  decision: 'accepted' | 'disputed',
): Client[] {
  return transition(clients, scenarioId, 'payer_response', decision === 'accepted' ? 'submitted' : 'ready_for_review')
}

// Tour anchor ids for the cases the guided tours point at.
export function tourIdFor(client: Client): string | undefined {
  return {
    'novo-ozempic-initial':   'tour-case-initial-pa',
    'novo-ozempic':           'tour-case-ozempic',
    'pediatric-esomeprazole': 'tour-case-infant',
    'gilead-livdelzi':        'tour-case-livdelzi',
  }[client.scenarioId]
}
