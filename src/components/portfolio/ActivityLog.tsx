import { type ActivityEntry } from './caseQueue'

// Every coordinator action this session, with a copy of each outbound
// artifact. Demo-local stand-in for the audit rail (ADR-0009/0011): live mode
// maps entries to AuditRecords. Renders nothing when the log is empty.
export function ActivityLog({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className="pb-4 border-b border-slate-800/60">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 select-none">
        Activity Log
      </p>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-mono text-slate-500 shrink-0">{entry.at}</span>
              <span className="font-semibold text-slate-200 shrink-0">{entry.action}</span>
              <span className="text-slate-400 truncate">{entry.detail}</span>
            </div>
            {entry.artifact && (
              <details className="mt-1.5">
                <summary className="text-xs text-sky-300 cursor-pointer select-none hover:text-sky-200">
                  View sent artifact — {entry.artifact.title}
                </summary>
                <pre className="mt-1.5 text-[11px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md p-2.5 whitespace-pre-wrap leading-relaxed">
                  {entry.artifact.body}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
