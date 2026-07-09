/**
 * Loads and refreshes the live pending-review queue (GET /api/reviews/pending).
 *
 * Fetches on mount and exposes `refresh` (called after a resume terminal) and
 * `drop` (optimistic removal via the pure `dropResolved`). A 401 surfaces
 * session expiry via `onExpire`.
 */
import { useCallback, useEffect, useState } from 'react'
import { getPendingReviews } from '../../../lib/api'
import type { PendingReviewItem } from '../../../lib/wire'
import { dropResolved } from './queue'
import { isSessionExpired } from './session'

export interface PendingQueue {
  reviews: PendingReviewItem[]
  refresh: () => Promise<void>
  drop: (correlationId: string) => void
}

export function usePendingQueue(enabled: boolean, onExpire: () => void): PendingQueue {
  const [reviews, setReviews] = useState<PendingReviewItem[]>([])

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      setReviews((await getPendingReviews()).reviews)
    } catch (err) {
      if (isSessionExpired(err)) onExpire()
    }
  }, [enabled, onExpire])

  const drop = useCallback(
    (correlationId: string) => setReviews(prev => dropResolved(prev, correlationId)),
    [],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { reviews, refresh, drop }
}
