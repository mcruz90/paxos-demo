/**
 * Live audit-trail panel (GET /api/audit/records).
 *
 * Identifiers/hashes only — never letter text (PHI rule; the records are
 * already shaped that way server-side). The compliance story: a resumed
 * exception run shows its `as_is` draft beside the human sign-off —
 * `human_approved` (cleared unchanged) or `human_edited` (text changed) —
 * with the reviewer's id. Provenance → chip style is a lookup map.
 */
import { ScrollText } from 'lucide-react'
import { TierBadge } from '../../ui'
import type { AuditRecord } from './auditTrail'

type Provenance = AuditRecord['provenance']

const PROVENANCE: Record<Provenance, { label: string; cls: string }> = {
  as_is: { label: 'AI as-is', cls: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  human_edited: { label: 'Human edited', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  human_approved: { label: 'Human approved (as-is)', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  gatekeeper_corrected: { label: 'Gatekeeper corrected', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

export function AuditTrailPanel({ records }: { records: AuditRecord[] }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <ScrollText className="w-4 h-4 text-slate-400" />
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Audit trail ({records.length})</p>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-slate-500">No runs recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r, i) => {
            const prov = PROVENANCE[r.provenance]
            return (
              <li key={`${r.correlation_id}-${i}`} className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white font-medium">{r.drug} — {r.plan}</span>
                  {r.tier && <TierBadge tier={r.tier} />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                  <span>{r.timestamp}</span>
                  <span>{r.lifecycle}</span>
                  <span className={r.outcome === 'error' ? 'text-rose-400' : 'text-emerald-400'}>{r.outcome}</span>
                  <span className={`px-2 py-0.5 rounded-full border ${prov.cls}`}>{prov.label}</span>
                  {r.reviewed_by && <span className="text-sky-400">by {r.reviewed_by}</span>}
                  {r.retry_count > 0 && <span className="text-amber-400">{r.retry_count} {r.retry_count === 1 ? 'retry' : 'retries'}</span>}
                </div>
                <p className="text-slate-600 text-xs mt-0.5 font-mono">{r.correlation_id}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
