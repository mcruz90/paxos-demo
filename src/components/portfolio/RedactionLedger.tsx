import { ShieldCheck, X } from 'lucide-react'
import { type RedactionEntry } from './redaction'

// Slide-over that accounts for the PHI stripped before this document reached
// the control plane: what category, how many, the token that replaced it, and
// the Safe-Harbor basis — never the identifier itself. Auditable de-id without
// re-exposing PHI. Renders over the document (parent must be `relative`).
export function RedactionLedger({
  entries,
  open,
  onClose,
}: {
  entries: RedactionEntry[]
  open: boolean
  onClose: () => void
}) {
  const total = entries.reduce((n, e) => n + e.count, 0)

  return (
    <div
      className={[
        'absolute inset-y-0 right-0 w-72 bg-slate-900 border-l border-slate-800 shadow-2xl',
        'flex flex-col transition-transform duration-300 z-20',
        open ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          Redaction Ledger
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
        <p className="text-xs text-slate-400 leading-relaxed">
          <b className="text-violet-300">{total}</b> identifier{total !== 1 ? 's' : ''} tokenized at
          ETL ingest (ADR-0014 target posture) — direct identifiers never render on this plane.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-6">
            No identifiers detected in this document.
          </p>
        ) : (
          entries.map(e => (
            <div key={e.category} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-200">{e.category}</span>
                <span className="text-[10px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                  ×{e.count}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500 mb-1">{e.token}</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">{e.reason}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
