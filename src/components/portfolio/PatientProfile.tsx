import { type ReactNode, useState } from 'react'
import { CheckCircle2, Clock, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { patientProfiles } from '../../data/patients'
import { getCaseStage } from '../../data/scenarios'
import { type CaseAssessment } from '../../lib/wire'
import { type Client, type ScenarioConfig } from '../../types'
import { StageBadge, StatusBadge } from '../ui'
import { formatAgeAtRequest, formatAssessmentReadinessLabel } from './caseAssessment'
import { type Patient, type PatientProfileData } from './patient'
import { WorkqueueRibbon } from './WorkqueueRibbon'

function ageFromDob(dob?: string): string | null {
  const m = dob?.match(/^(\d{4})/) ?? dob?.match(/(\d{4})$/)
  if (!m) return null
  const age = 2026 - Number(m[1])
  return age >= 0 && age <= 120 ? `${age}` : null
}

function CollapsedStoryboardRail({ activeClient, displayName, onExpand }: {
  activeClient?: Client; displayName: string; onExpand: () => void
}) {
  const urgencyDot = activeClient?.urgency === 'today' ? 'bg-red-500' : activeClient?.urgency === 'soon' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <aside id="tour-epic-storyboard" className="w-12 shrink-0 border-r border-slate-800 epic-storyboard bg-slate-900/40 flex flex-col items-center py-3 gap-3">
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand patient storyboard"
        title={`Expand ${displayName} storyboard`}
        className="w-8 h-8 rounded-lg border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 flex items-center justify-center transition-colors"
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>
      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center relative" title={displayName}>
        <User className="w-4 h-4 text-slate-400" />
        <span className={`w-2 h-2 rounded-full absolute -top-0.5 -right-0.5 ${urgencyDot}`} />
      </div>
    </aside>
  )
}

function StoryboardHeader({ patient, scenario, activeClient, assessment, onCollapse }: {
  patient: Patient; scenario: ScenarioConfig; activeClient?: Client; assessment?: CaseAssessment | null; onCollapse: () => void
}) {
  const ageStr = assessment
    ? assessment.age_years !== null ? `${assessment.age_years}` : null
    : ageFromDob(patient.dob)
  const sexStr = scenario.patientContext?.patientSex
  return (
    <div className="pb-3.5 border-b border-slate-800 text-center space-y-1.5 relative">
      <button
        type="button"
        onClick={onCollapse}
        aria-label="Collapse patient storyboard"
        title="Collapse storyboard to widen workspace"
        className="absolute top-0 right-0 p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
      >
        <PanelLeftClose className="w-4 h-4" />
      </button>
      <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mx-auto">
        <User className="w-7 h-7 text-slate-400" />
      </div>
      <h2 className="text-sm font-bold text-white uppercase tracking-wide leading-tight pt-1">
        {patient.displayName}{ageStr ? `, ${ageStr}${sexStr && sexStr !== '—' ? sexStr : ''}` : ''}
      </h2>
      <div className="text-xs text-slate-400 space-y-0.5">
        {patient.dob && <p>DOB {patient.dob} · <span className="font-mono">{patient.patientRef}</span></p>}
        {assessment && (
          <p className="text-slate-300 font-medium">{formatAgeAtRequest(assessment.age_years)} (claim DOS)</p>
        )}
        <p className="leading-snug">{scenario.plan} · {scenario.planId}</p>
      </div>
      {activeClient && (
        <div className="pt-1 flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" /> SLA Clock: {activeClient.deadline}
          </span>
          <StageBadge stage={getCaseStage(activeClient)} />
        </div>
      )}
    </div>
  )
}

function StoryboardDetails({ patient, scenario, activeScenarioId, profile, assessment, onSelectCase }: {
  patient: Patient; scenario: ScenarioConfig; activeScenarioId: string; profile?: PatientProfileData; assessment?: CaseAssessment | null; onSelectCase: (sid: string) => void
}) {
  const history = profile?.paHistory ?? []
  const diagnoses = profile?.clinical?.diagnoses ?? [{ code: '', label: scenario.diagnosis }]
  const medications = profile?.clinical?.medications ?? []
  const trials = profile?.trials ?? []
  const allergies = profile?.clinical?.allergies ?? ['NKDA']

  return (
    <>
      {assessment && (
        <div className="space-y-1.5 pb-2 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-200">Assessment Criteria</p>
            <span className="text-[10px] font-mono text-slate-400">rev {assessment.revision}</span>
          </div>
          <p className="text-[11px] text-slate-300">{formatAssessmentReadinessLabel(assessment)}</p>
          <div className="space-y-1">
            {assessment.findings.map(row => (
              <div key={row.criterion_id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono text-slate-300 truncate">{row.criterion_id}</span>
                <span className={row.status === 'met' ? 'text-emerald-400' : row.status === 'conflict' ? 'text-red-300' : 'text-amber-300'}>
                  {row.status === 'met' ? 'Met' : row.status === 'conflict' ? 'Conflict' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-200">Active Problems</p>
        <div className="space-y-1 text-xs text-slate-300 leading-snug">
          {diagnoses.map((d, i) => <p key={i}>{d.label} {d.code && <span className="font-mono text-slate-400">({d.code})</span>}</p>)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-200">Step-Therapy Trials</p>
          {profile?.compliance && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700">PDC {profile.compliance.pdc}</span>}
        </div>
        <div className="space-y-1 text-xs text-slate-300 leading-snug">
          {trials.length > 0 ? trials.slice(0, 2).map((t, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span><span className="font-mono text-[11px] text-slate-400">{t.date}</span> · {t.therapy} ({t.supply})</span>
            </p>
          )) : medications.length > 0 ? medications.slice(0, 2).map((m, i) => <p key={i}>{m.name} · {m.sig}</p>) : (
            <p className="text-slate-500 italic">No external pharmacy fill log in fixture; refer to source citations.</p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-200">Allergies</p>
        <p className="text-xs text-slate-300 leading-snug">{allergies.join(', ')}</p>
      </div>
      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <p className="text-xs font-bold text-slate-200">PA History</p>
        <div className="space-y-1.5">
          {patient.cases.map(c => (
            <button key={c.id} type="button" onClick={() => onSelectCase(c.scenarioId)}
              className={`w-full text-left rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${c.scenarioId === activeScenarioId ? 'epic-card border-blue-500/50 text-slate-100 font-semibold' : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700'}`}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate">{c.drug.split(' ')[0]} (Current)</span>
                <StatusBadge status={c.status} />
              </div>
            </button>
          ))}
          {history.map((h, i) => (
            <div key={i} className="text-xs text-slate-400 px-1 flex items-center justify-between gap-1">
              <span className="truncate">{h.drug}</span>
              <span className="text-emerald-400 shrink-0 capitalize">{h.decision}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function PatientProfile({
  patient, scenario, activeScenarioId, clients, onSelectClient, onSelectCase, onBackToQueue, onInspectInBuild, assessment, workspace,
}: {
  patient: Patient; scenario: ScenarioConfig; activeScenarioId: string; clients: Client[]
  onSelectClient: (id: number) => void; onSelectCase: (scenarioId: string) => void
  onBackToQueue: () => void; onInspectInBuild?: (scenarioId: string) => void; assessment?: CaseAssessment | null; workspace: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const profile = patientProfiles[patient.patientRef]
  const activeClient = clients.find(c => c.scenarioId === activeScenarioId) ?? patient.cases[0]

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <WorkqueueRibbon clients={clients} activeScenarioId={activeScenarioId} onSelectClient={onSelectClient} onBackToQueue={onBackToQueue} onInspectInBuild={onInspectInBuild} />
      <div className="flex-1 flex overflow-hidden min-h-0">
        {collapsed ? (
          <CollapsedStoryboardRail activeClient={activeClient} displayName={patient.displayName} onExpand={() => setCollapsed(false)} />
        ) : (
          <aside id="tour-epic-storyboard" className="w-60 shrink-0 border-r border-slate-800 epic-storyboard bg-slate-900/40 overflow-y-auto p-4 space-y-4">
            <StoryboardHeader patient={patient} scenario={scenario} activeClient={activeClient} assessment={assessment} onCollapse={() => setCollapsed(true)} />
            <StoryboardDetails patient={patient} scenario={scenario} activeScenarioId={activeScenarioId} profile={profile} assessment={assessment} onSelectCase={onSelectCase} />
          </aside>
        )}
        <div className="flex-1 flex overflow-hidden min-w-0">{workspace}</div>
      </div>
    </div>
  )
}
