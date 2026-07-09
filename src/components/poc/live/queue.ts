/**
 * Pure helpers for the live pending-review queue (GET /api/reviews/pending).
 *
 * The queue is authoritative on the server; after a resume completes we refetch
 * it. `dropResolved` gives the reviewer an immediate optimistic removal so the
 * row disappears the instant the resume's terminal `done` arrives, before the
 * refetch lands. `shouldRefreshQueue` is the terminal→refetch predicate. Both
 * pure so the queue-refresh logic is unit-tested without a server.
 */
import type { PendingReviewItem, ResumeEvent } from '../../../lib/wire'

/** Remove the just-resumed run from a queue snapshot (optimistic update). */
export function dropResolved(reviews: PendingReviewItem[], correlationId: string): PendingReviewItem[] {
  return reviews.filter(r => r.correlation_id !== correlationId)
}

/** A successful resume (`done`) clears the parked run — refetch the queue. */
export function shouldRefreshQueue(event: ResumeEvent): boolean {
  return event.event === 'done'
}
