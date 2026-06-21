import { Send, ShieldCheck } from 'lucide-react'
import type { CaseLifecycle } from '../../types'

// How an authorized request actually reaches the payer. Primary path is electronic
// prior auth (HL7 FHIR Da Vinci PAS, backed by X12 278); legacy payers fall back
// to portal/secure fax. CMS-0057-F mandates payer ePA APIs by Jan 2027, so the
// electronic path widens over time. The packet + payer acknowledgment are written
// back to the system of record via the same connector that ingested the case.
// Copy leads with the rail that matches the artifact: PAS for an initial PA, the
// appeal channel for an appeal.
export function TransmissionReceipt({ plan, lifecycle = 'appeal' }: { plan: string; lifecycle?: CaseLifecycle }) {
  const isInitialPa = lifecycle === 'initial_pa'
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">Transmission channel</h3>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">ePA · Da Vinci PAS / X12 278</span>
      </div>
      {isInitialPa ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          Paxos files the full PA lifecycle — initial prior auths, appeals, and determinations. <span className="text-slate-300">This initial PA request</span> transmits to {plan} over the electronic prior-authorization API (HL7 FHIR Da Vinci PAS, backed by X12&nbsp;278) — the structured questionnaire and FHIR bundle go straight to the payer's UM system. Payers not yet on ePA fall back to secure portal/fax. A denial would route to the payer's appeal channel — same packet, same audit trail.
        </p>
      ) : (
        <p className="text-xs text-slate-400 leading-relaxed">
          Paxos files the full PA lifecycle — initial prior auths, appeals, and determinations. <span className="text-slate-300">Initial PA requests</span> transmit to {plan} over the electronic prior-authorization API (HL7 FHIR Da Vinci PAS, backed by X12&nbsp;278) where the payer supports it. <span className="text-slate-300">This appeal</span> files through the payer's appeal channel or portal — same packet, same audit trail. Payers not yet on ePA fall back to secure fax.
        </p>
      )}
      <div className="flex items-start gap-2 px-3 py-2 bg-slate-900/40 border border-slate-700/50 rounded-lg">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">CMS-0057-F mandates payer ePA APIs by Jan 2027 — the electronic path widens as payers comply. The submitted packet and payer acknowledgment are written back to the system of record (EHR/CRM) via the same connector that ingested the case.</p>
      </div>
    </div>
  )
}
