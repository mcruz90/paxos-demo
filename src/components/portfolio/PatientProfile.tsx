import { type ReactNode, useEffect, useState } from 'react'
import { ArrowLeft, Database, FileText, FolderOpen, Stethoscope, User } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { patientProfiles } from '../../data/patients'
import { ClinicalProfile } from './ClinicalProfile'
import { type Patient } from './patient'
import { PatientDocVault } from './PatientDocVault'
import { PriorAuthHub } from './PriorAuthHub'
import { TrialAdherenceLog } from './TrialAdherenceLog'

type ModuleKey = 'clinical' | 'pa-hub' | 'trials' | 'vault'

const MODULES: { key: ModuleKey; label: string; Icon: typeof User }[] = [
  { key: 'clinical', label: 'Clinical Profile',      Icon: Stethoscope },
  { key: 'pa-hub',   label: 'Prior Auth Hub',        Icon: FileText },
  { key: 'trials',   label: 'Trial & Adherence Log', Icon: Database },
  { key: 'vault',    label: 'Document Vault & Q&A',  Icon: FolderOpen },
]

// Patient-centric shell: a module sidebar over one patient's whole file. The
// Prior Auth Hub hosts the active case workspace (passed in as `workspace`);
// the other modules render patient-level data. Demo-only patient↔case grouping
// (O9/G1 backend gap).
export function PatientProfile({
  patient,
  scenario,
  activeScenarioId,
  onSelectCase,
  onBackToQueue,
  workspace,
}: {
  patient: Patient
  scenario: ScenarioConfig
  activeScenarioId: string
  onSelectCase: (scenarioId: string) => void
  onBackToQueue: () => void
  workspace: ReactNode
}) {
  const [active, setActive] = useState<ModuleKey>('pa-hub')
  useEffect(() => { setActive('pa-hub') }, [patient.patientRef])

  const profile = patientProfiles[patient.patientRef]
  const history = profile?.paHistory ?? []
  const paCount = patient.cases.length + history.length

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Patient banner */}
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <button onClick={onBackToQueue} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Queue
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white leading-tight">{patient.displayName}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
              <span className="font-mono text-slate-500">{patient.patientRef}</span>
              {patient.dob && <><span className="text-slate-700">·</span><span>DOB {patient.dob}</span></>}
              {patient.payer && <><span className="text-slate-700">·</span><span>{patient.payer}</span></>}
              <span className="text-slate-700">·</span>
              <span>{paCount} prior auth{paCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module sidebar + content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <nav className="w-56 shrink-0 border-r border-slate-800 p-3 space-y-1 bg-slate-950/30">
          {MODULES.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors',
                active === key
                  ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent',
              ].join(' ')}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="leading-tight">{label}</span>
              {key === 'pa-hub' && (
                <span className="ml-auto text-[10px] font-mono text-slate-500">{paCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-h-0 overflow-hidden">
          {active === 'pa-hub' ? (
            <PriorAuthHub
              patient={patient}
              activeScenarioId={activeScenarioId}
              history={history}
              onSelectCase={onSelectCase}
              workspace={workspace}
            />
          ) : (
            <div className="h-full overflow-y-auto p-6">
              {active === 'clinical' && <ClinicalProfile data={profile?.clinical} scenario={scenario} />}
              {active === 'trials'   && <TrialAdherenceLog data={profile} />}
              {active === 'vault'    && (
                <PatientDocVault
                  documents={scenario.sourceDocuments ?? []}
                  data={profile}
                  patientRef={patient.patientRef}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
