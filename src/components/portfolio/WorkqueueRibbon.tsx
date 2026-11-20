import { ChevronRight, LayoutList, Terminal } from 'lucide-react'
import { type Client } from '../../types'

const STATUS_DOT: Record<Client['status'], string> = {
  exception: 'bg-red-500',
  payer_response: 'bg-violet-500',
  ready_for_review: 'bg-emerald-500',
  awaiting_documentation: 'bg-sky-500',
  submitted: 'bg-slate-400',
  processing: 'bg-blue-500',
}

function lastNameOnly(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : name
}

export function WorkqueueRibbon({
  clients,
  activeScenarioId,
  onSelectClient,
  onBackToQueue,
  onInspectInBuild,
}: {
  clients: Client[]
  activeScenarioId: string
  onSelectClient: (id: number) => void
  onBackToQueue: () => void
  onInspectInBuild?: (scenarioId: string) => void
}) {
  const exceptionCount = clients.filter(c => c.status === 'exception').length
  const payerCount = clients.filter(c => c.status === 'payer_response').length
  const readyCount = clients.filter(c => c.status === 'ready_for_review').length
  const currentIdx = clients.findIndex(c => c.scenarioId === activeScenarioId)
  const nextClient = clients.length > 1 ? clients[(currentIdx + 1) % clients.length] : null

  return (
    <div id="tour-workqueue-ribbon" className="px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBackToQueue} aria-label="Back to Queue" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors shrink-0">
          <LayoutList className="w-3.5 h-3.5 text-slate-400" />
          Full Workqueue View
        </button>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto justify-end">
          {clients.map(c => {
            const active = c.scenarioId === activeScenarioId
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClient(c.id)}
                title={`${c.patientDisplayName ?? c.name} — ${c.drug} (${c.deadline})`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-all shrink-0 ${
                  active ? 'bg-blue-500/10 border-blue-500/60 text-slate-100 font-semibold shadow-sm' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
                <span>{lastNameOnly(c.patientDisplayName ?? c.name)} · {c.drug.split(' ')[0]}</span>
                {active && <span className="text-[11px] text-blue-400">(Active)</span>}
                {!active && c.status === 'ready_for_review' && <span className="text-emerald-400 font-bold">✓</span>}
              </button>
            )
          })}
          {nextClient && (
            <button type="button" onClick={() => onSelectClient(nextClient.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0">
              Next Case <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 text-xs flex-wrap">
          <span className="font-semibold text-slate-200">{clients.length} Total:</span>
          {exceptionCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500" /> {exceptionCount} Needs Investigation
            </span>
          )}
          <span className="text-slate-700">·</span>
          {payerCount > 0 && (
            <>
              <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-violet-500" /> {payerCount} Payer Response
              </span>
              <span className="text-slate-700">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {readyCount} Ready for Human Review
          </span>
          <button
            type="button"
            disabled
            title="Out of scope for Milestone 1 — each case requires individual human packet review"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-slate-700 bg-slate-900/40 text-slate-400 text-xs font-semibold opacity-60 cursor-not-allowed"
          >
            Batch Approve (Demo Only)
          </button>
        </div>
        {onInspectInBuild && (
          <button
            type="button"
            onClick={() => onInspectInBuild(activeScenarioId)}
            title="Open this case's PII-redacted tokenizer & clearauth-eval trace in Build mode"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors shrink-0"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            Inspect in Build
          </button>
        )}
      </div>
    </div>
  )
}
