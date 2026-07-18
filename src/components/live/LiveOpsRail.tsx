import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { usePendingQueue } from '../poc/live/usePendingQueue'
import { useAuditTrail } from '../poc/live/useAuditTrail'
import { useLiveAppeal } from '../poc/live/useLiveAppeal'
import { shouldRefreshQueue } from '../poc/live/queue'
import { PendingQueue } from '../poc/live/PendingQueue'
import { AuditTrailPanel } from '../poc/live/AuditTrailPanel'
import { ResumeEditor } from '../poc/live/ResumeEditor'
import { CapabilityChip } from './CapabilityChip'
import { type LiveShellSession } from './SessionGate'
import { type CapabilityManifest } from '../../capabilities'
import type { PendingReviewItem } from '../../lib/wire'

/**
 * Migration slice 1 (ADR-0016): the already-live flows — O7 pending-review
 * queue, O5 exception resume, B8 audit trail — rendered inside the portfolio
 * shell. Composes the Sprint FI hooks/components unchanged; each unit mounts
 * only when the manifest marks it live and wears the LIVE chip. Letter
 * generation is NOT here yet (Workstream SU slice 2) — a parked run resumed
 * from this rail starts from an empty draft (approve as-is or paste edits),
 * exactly like opening a queue item cold in the dev console.
 */
export function LiveOpsRail({ manifest, live }: { manifest: CapabilityManifest; live: LiveShellSession }) {
  const { csrfToken, userId, onLogout, onExpire } = live
  const queue = usePendingQueue(manifest.O7_pending_queue === 'live', onExpire)
  const audit = useAuditTrail(manifest.B8_audit_trail === 'live', onExpire)
  const appeal = useLiveAppeal(csrfToken, onExpire)
  const [resumeTarget, setResumeTarget] = useState<PendingReviewItem | null>(null)
  const [resumeBusy, setResumeBusy] = useState(false)

  const handleResume = async (editedText: string | null) => {
    if (!resumeTarget) return
    setResumeBusy(true)
    const result = await appeal.resume(resumeTarget.correlation_id, editedText, csrfToken)
    setResumeBusy(false)
    // An error terminal (e.g. double-resume) or transport failure leaves the
    // run parked — keep the editor open so the reviewer's edits aren't lost.
    if (!shouldRefreshQueue(result)) return
    queue.drop(resumeTarget.correlation_id)
    await Promise.all([queue.refresh(), audit.refresh()])
    setResumeTarget(null)
  }

  return (
    <aside className="w-96 shrink-0 border-l border-slate-800 overflow-y-auto p-4 space-y-4 bg-slate-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white">Live operations</h2>
          <CapabilityChip cap="live" />
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> {userId}
        </button>
      </div>

      {manifest.O7_pending_queue === 'live' && (
        <PendingQueue
          reviews={queue.reviews}
          activeId={resumeTarget?.correlation_id ?? null}
          onOpen={setResumeTarget}
        />
      )}

      {manifest.O5_resume === 'live' && resumeTarget && (
        <ResumeEditor
          key={resumeTarget.correlation_id}
          correlationId={resumeTarget.correlation_id}
          draft=""
          busy={resumeBusy}
          error={appeal.state.status === 'error' ? appeal.state.error : null}
          onResume={handleResume}
        />
      )}

      {manifest.B8_audit_trail === 'live' && <AuditTrailPanel records={audit.records} />}
    </aside>
  )
}
