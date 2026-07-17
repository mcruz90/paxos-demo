import { AlertOctagon, Pill, Stethoscope } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { type ClinicalProfileData } from './patient'

// Patient-level clinical summary: problem list, current meds, allergies.
// Falls back to the active scenario's diagnosis when no profile is authored
// (honest — it never fabricates a fuller chart than the data supports).
export function ClinicalProfile({
  data,
  scenario,
}: {
  data?: ClinicalProfileData
  scenario: ScenarioConfig
}) {
  const diagnoses = data?.diagnoses ?? [{ code: '', label: scenario.diagnosis }]
  const medications = data?.medications ?? []
  const allergies = data?.allergies ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {data?.summary && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Clinical Summary</p>
          <p className="text-sm text-slate-200 leading-relaxed">{data.summary}</p>
        </div>
      )}

      <Section icon={<Stethoscope className="w-4 h-4 text-emerald-400" />} title="Active Diagnoses">
        <div className="space-y-2">
          {diagnoses.map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-3.5 py-2.5">
              {d.code && (
                <span className="text-[11px] font-mono font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 shrink-0">
                  {d.code}
                </span>
              )}
              <span className="text-sm text-slate-200 flex-1">{d.label}</span>
              {d.since && <span className="text-xs text-slate-500 shrink-0">since {d.since}</span>}
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Pill className="w-4 h-4 text-violet-400" />} title="Current Medications">
        {medications.length ? (
          <div className="space-y-2">
            {medications.map((m, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-3.5 py-2.5">
                <span className="text-sm font-medium text-slate-200">{m.name}</span>
                <span className="text-xs text-slate-400 font-mono">{m.sig}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">Medication list not loaded for this patient (demo).</p>
        )}
      </Section>

      <Section icon={<AlertOctagon className="w-4 h-4 text-amber-400" />} title="Allergies">
        {allergies.length ? (
          <div className="flex flex-wrap gap-2">
            {allergies.map((a, i) => (
              <span key={i} className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1">{a}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No allergies recorded.</p>
        )}
      </Section>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  )
}
