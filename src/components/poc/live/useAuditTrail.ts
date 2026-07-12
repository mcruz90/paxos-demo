/**
 * Loads and refreshes the live audit trail (GET /api/audit/records).
 *
 * Mirror of usePendingQueue: fetches on mount, exposes `refresh` (called after
 * any terminal event and after a successful resume), sorts newest-first via the
 * pure `sortAuditNewestFirst`. A 401 surfaces session expiry via `onExpire`.
 */
import { useCallback, useEffect, useState } from 'react'
import { getAuditRecords } from '../../../lib/api'
import { sortAuditNewestFirst, type AuditRecord } from './auditTrail'
import { isSessionExpired } from './session'

export interface AuditTrail {
  records: AuditRecord[]
  refresh: () => Promise<void>
}

export function useAuditTrail(enabled: boolean, onExpire: () => void): AuditTrail {
  const [records, setRecords] = useState<AuditRecord[]>([])

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      setRecords(sortAuditNewestFirst((await getAuditRecords()).records))
    } catch (err) {
      if (isSessionExpired(err)) onExpire()
    }
  }, [enabled, onExpire])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { records, refresh }
}
