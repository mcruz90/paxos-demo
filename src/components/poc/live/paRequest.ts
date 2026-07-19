/**
 * Pure ScenarioConfig → InitialPaRequest mapper for the live initial-PA stream.
 *
 * The initial-PA lifecycle precedes any payer denial, so — unlike the appeal
 * request — there is no denial text to quote; the body carries the CRD inputs
 * and the therapy being requested (InitialPaRequest, backend/models/requests.py).
 * `criteria_results` still carries through verbatim (same fixture contract as
 * the appeal path). Pure so the mapping is unit-tested.
 */
import type { ScenarioConfig } from '../../../types'
import type { InitialPaRequest } from '../../../lib/wire'

export function buildPaRequest(scenario: ScenarioConfig, attempt = 1): InitialPaRequest {
  return {
    scenario_id: scenario.id,
    // No top-level case ref on the fixture; the backend derives the correlation
    // id from scenario_id when case_ref is empty (audit/ids.py).
    case_ref: '',
    drug: scenario.drug,
    plan: scenario.plan,
    plan_id: scenario.planId,
    diagnosis: scenario.diagnosis,
    requested_therapy: scenario.requestedTherapy ?? '',
    criteria_results: scenario.criteriaResults as InitialPaRequest['criteria_results'],
    attempt,
    security_hold: false,
    security_reason: '',
    // Tenancy seam (ADR-0017): pre-DB the demo operates in the single seeded
    // tenant. At the Phase 3 durable store the owning tenant becomes
    // session-derived server-side (the client stops asserting it).
    tenant_id: 'tenant_demo',
  }
}
