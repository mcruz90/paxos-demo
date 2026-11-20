import { AlertTriangle } from 'lucide-react'
import { type CapabilityManifest } from '../../capabilities'
import { type PendingReviewItem } from '../../lib/wire'
import { type Client } from '../../types'
import { FAILURE_CLUSTERS, SEVERITY_CLS } from '../FailureReviewView'
import { CapabilityChip } from '../live/CapabilityChip'
import { type LiveShellSession } from '../live/SessionGate'
import { AuditTrailPanel } from '../poc/live/AuditTrailPanel'
import { PendingQueue } from '../poc/live/PendingQueue'
import { ResumeEditor } from '../poc/live/ResumeEditor'
import { useAuditTrail } from '../poc/live/useAuditTrail'
import { usePendingQueue } from '../poc/live/usePendingQueue'

function SimulatedTraceNotice() {
  const stages = [
    '1. ETL PII tokenization prepares non-PHI text before model calls.',
    '2. LangGraph criteria extractor checks policy requirements.',
    '3. Deterministic gatekeeper evaluates structural integrity.',
    '4. AuditRecord writes before any terminal SSE done/error event.',
  ]
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-mono text-slate-300">No live SSE run executed</span>
        <CapabilityChip cap="simulated" />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        No live SSE run executed — illustrative pipeline stages (simulated):
      </p>
      <div className="space-y-1.5 font-mono text-[11px] bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-slate-400">
        {stages.map(line => (
          <div key={line} className="leading-relaxed">{line}</div>
        ))}
      </div>
    </div>
  )
}

function TechnicalExceptionsCard({ client, unresolvedCount }: { client: Client; unresolvedCount: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-1.5 whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          Technical Exceptions ({unresolvedCount > 0 ? FAILURE_CLUSTERS.length : FAILURE_CLUSTERS.length - 1})
        </span>
        <span className="text-[11px] text-slate-500 whitespace-nowrap">Informaticist triage</span>
      </div>
      <div className="space-y-2">
        {unresolvedCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-amber-200">Active Gap ({client.name})</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 whitespace-nowrap shrink-0">
                {unresolvedCount} open
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">{client.gapSummary}</p>
          </div>
        )}
        {FAILURE_CLUSTERS.slice(0, 3).map(c => (
          <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-200">{c.mode}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${SEVERITY_CLS[c.severity]}`}>
                {c.severity}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{c.proposedFix}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function InspectorAuditColumn({
  client,
  unresolvedCount,
  live,
  manifest,
  queue,
  audit,
  draftLetter,
  resumeTarget,
  onSelectResume,
  resumeBusy,
  resumeError,
  onResume,
}: {
  client: Client
  unresolvedCount: number
  live?: LiveShellSession
  manifest: CapabilityManifest
  queue: ReturnType<typeof usePendingQueue>
  audit: ReturnType<typeof useAuditTrail>
  draftLetter: string
  resumeTarget: PendingReviewItem | null
  onSelectResume: (item: PendingReviewItem) => void
  resumeBusy: boolean
  resumeError: string | null
  onResume: (editedText: string | null) => void
}) {
  return (
    <div className="lg:col-span-4 overflow-y-auto p-4 space-y-3.5 bg-slate-950/60">
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 gap-2">
        <h2 className="text-sm font-semibold text-white whitespace-nowrap">Live SSE Audit &amp; Escalations</h2>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap shrink-0">
          {live ? `SSE LIVE · ${live.userId}` : 'SIMULATED SHELL'}
        </span>
      </div>

      {live ? (
        <div className="space-y-3.5">
          {manifest.O7_pending_queue === 'live' && (
            <PendingQueue reviews={queue.reviews} activeId={resumeTarget?.correlation_id ?? null} onOpen={onSelectResume} />
          )}
          {manifest.O5_resume === 'live' && resumeTarget && (
            <ResumeEditor
              key={resumeTarget.correlation_id}
              correlationId={resumeTarget.correlation_id}
              draft={draftLetter}
              busy={resumeBusy}
              error={resumeError}
              onResume={onResume}
            />
          )}
          {manifest.B8_audit_trail === 'live' && <AuditTrailPanel records={audit.records} />}
        </div>
      ) : (
        <SimulatedTraceNotice />
      )}

      <TechnicalExceptionsCard client={client} unresolvedCount={unresolvedCount} />
    </div>
  )
}
