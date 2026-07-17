import { CheckCircle2, Database } from 'lucide-react'
import { type PatientProfileData } from './patient'

// Step-therapy / previous-trial history verified against interoperability
// networks (Surescripts / Carequality). This is the patient-level source for
// the exception resolver's EHR auto-verify — dispense records that prove a
// prior therapy trial. Demo rail: the FHIR verification is simulated, and the
// compliance figure is fixture data, not a live audit aggregate.
export function TrialAdherenceLog({ data }: { data?: PatientProfileData }) {
  const trials = data?.trials ?? []

  if (trials.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic text-center py-10">
        No verified trial history indexed for this patient (demo).
      </p>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Database className="w-4 h-4 text-emerald-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Step Therapy &amp; Previous Trial History</h3>
            <p className="text-xs text-slate-500 mt-0.5 max-w-md leading-relaxed">
              Audit log of verified medication trials extracted from interoperability networks (Surescripts, Carequality).
            </p>
          </div>
        </div>
        {data?.compliance && (
          <div className="flex gap-3 shrink-0">
            <Stat label="Compliance (PDC)" value={data.compliance.pdc} tone="text-emerald-400" />
            <Stat label="Trial duration" value={`${data.compliance.durationDays}d`} tone="text-violet-300" />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/60 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="text-left font-semibold px-4 py-2.5">Date</th>
              <th className="text-left font-semibold px-4 py-2.5">Therapy</th>
              <th className="text-left font-semibold px-4 py-2.5">Facility</th>
              <th className="text-left font-semibold px-4 py-2.5">Qty / Supply</th>
              <th className="text-left font-semibold px-4 py-2.5">Reference</th>
              <th className="text-left font-semibold px-4 py-2.5">Verification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trials.map((t, i) => (
              <tr key={i} className="hover:bg-slate-800/20">
                <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-3 font-medium text-slate-200">{t.therapy}</td>
                <td className="px-4 py-3 text-slate-400">{t.facility}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{t.quantity} · {t.supply}</td>
                <td className="px-4 py-3 font-mono text-xs text-sky-300 whitespace-nowrap">{t.fhirRef}</td>
                <td className="px-4 py-3">
                  {t.verified ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-md px-2 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Audited FHIR Record
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Unverified</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-600">
        Demo rail — FHIR verification simulated; compliance is fixture data, not a live audit aggregate.
      </p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3.5 py-2 text-center">
      <p className={`text-lg font-bold font-display leading-none ${tone}`}>{value}</p>
      <p className="text-[9px] text-slate-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  )
}
