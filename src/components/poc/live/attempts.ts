/**
 * Per-scenario resubmission attempt tracking (ADR-0009 idempotency).
 *
 * The backend idempotency key is `case_id` + submission `attempt`; a retried
 * request with the same key must not double-submit, while a *deliberate*
 * regenerate must be a distinct run (its own correlation_id / HITL thread).
 * So each regenerate of a scenario bumps its attempt — otherwise re-parking a
 * run reuses the first run's correlation_id and the new checkpoint is invisible
 * in the review queue. Pure so the counting is unit-tested without React.
 */

/** Scenario id → attempts submitted so far this session. */
export type AttemptMap = Map<string, number>

/** Next attempt for a scenario: 1 on first generate, +1 on each regenerate. */
export function nextAttempt(attempts: AttemptMap, scenarioId: string): number {
  const attempt = (attempts.get(scenarioId) ?? 0) + 1
  attempts.set(scenarioId, attempt)
  return attempt
}
