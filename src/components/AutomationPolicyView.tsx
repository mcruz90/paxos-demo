import { Building2, Info } from 'lucide-react'
import { TENANT } from '../data/scenarios'
import { ReviewPolicyControl } from './ReviewPolicyControl'

// Operate-layer surface — CLIENT-OWNED. This is where the customer's PA team tunes
// their own automation policy day-to-day (the Telus-Kroll "client self-serve"
// boundary). Paxos sets sensible defaults at onboarding; the client adjusts them
// here without involving Paxos. Distinct from the onboarding Review Tiers step,
// which only previews these defaults.
export function AutomationPolicyView() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Automation Policy</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            How much routine volume to auto-assemble and queue vs. review in depth — your team owns this knob
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700"
          title={`Operating as ${TENANT.name} — ${TENANT.type}.`}
        >
          <Building2 className="w-3 h-3 text-slate-400" />
          <span className="text-slate-200 font-medium">{TENANT.name}</span>
        </span>
      </div>

      <div className="px-8 py-6 max-w-3xl space-y-4">
        <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Paxos stands up the capability and a sensible default at onboarding; from here, your PA team adjusts the
            policy directly — no implementation ticket required. Changes apply to new cases entering the queue.
          </p>
        </div>

        <ReviewPolicyControl routineVolumePct={55} />
      </div>
    </div>
  )
}
