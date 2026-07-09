/**
 * Pure ScenarioConfig → AppealRequest mapper for live-mode generation.
 *
 * The live POC view drives the same fixture scenarios as the simulated flow,
 * so the request body is derived from the selected `ScenarioConfig`. The
 * backend re-routes the HITL tier from `criteria_results[].confidence`
 * (tier_router.py), so those must be carried through verbatim — that is what
 * makes a low-confidence fixture (e.g. the pediatric esomeprazole case, 0.45)
 * park at the exception tier. Pure so the mapping is unit-tested.
 */
import type { ScenarioConfig } from '../../../types'
import type { AppealRequest } from '../../../lib/wire'

export function buildAppealRequest(scenario: ScenarioConfig, attempt = 1): AppealRequest {
  return {
    scenario_id: scenario.id,
    drug: scenario.drug,
    plan: scenario.plan,
    plan_id: scenario.planId,
    diagnosis: scenario.diagnosis,
    denial_reason: scenario.denialReason,
    // The fixtures carry a short denial reason, not a full letter; reuse it as
    // the denial text (the mock backend does not parse a real letter).
    denial_text: scenario.denialReason,
    criteria_results: scenario.criteriaResults as AppealRequest['criteria_results'],
    attempt,
    security_hold: false,
    security_reason: '',
  }
}
