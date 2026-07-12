/**
 * Pure derivation for the audit-trail panel.
 *
 * The audit list (audit/store.py) is append-order; the compliance view wants
 * newest first. Kept pure (returns a new array) so the ordering is unit-tested
 * and the hook stays a thin fetch wrapper.
 */
import type { AuditRecord } from '../../../lib/wire'

export function sortAuditNewestFirst(records: AuditRecord[]): AuditRecord[] {
  return [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
