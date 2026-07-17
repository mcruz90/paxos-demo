import { Building2 } from 'lucide-react'
import { type Client } from '../../types'
import { TENANT } from '../../data/scenarios'
import { countActionable } from './caseQueue'

// Triage chrome above the queue — tenant identity, action counts, and the
// Epic-sync pill. Hidden while a case is open (focus mode); the workspace
// header carries the case identity instead.
export function QueueHeader({ clients }: { clients: Client[] }) {
  const actionableCount = countActionable(clients)
  const submittedCount  = clients.filter(c => c.status === 'submitted').length

  return (
    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold font-display text-white">Case Queue</h1>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700"
            title={`Operating as ${TENANT.name} — ${TENANT.type}. Cases sourced from ${TENANT.source}.`}
          >
            <Building2 className="w-3 h-3 text-slate-400" />
            <span className="text-slate-200 font-medium">{TENANT.name}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{TENANT.source}</span>
          </span>
        </div>
        <p className="text-sm mt-0.5 flex items-center gap-2">
          {actionableCount > 0
            ? <span className="text-white font-medium">{actionableCount} case{actionableCount !== 1 ? 's' : ''} need your action</span>
            : <span className="text-slate-400">All cases up to date</span>}
          {submittedCount > 0 && (
            <><span className="text-slate-700">·</span>
            <span className="text-slate-500 text-xs">{submittedCount} awaiting payer</span></>
          )}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40"
          title="Cases import automatically from Epic via FHIR Subscriptions the moment the record updates."
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-slate-300">Auto-synced from Epic · live</span>
        </div>
      </div>
    </div>
  )
}
