import { type ReactNode } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  LayoutList,
  Terminal,
  User,
} from 'lucide-react'
import { type Client, type ScenarioConfig } from '../../types'
import { patientProfiles } from '../../data/patients'
import { getCaseStage } from '../../data/scenarios'
import { StageBadge, StatusBadge } from '../ui'
import { type Patient } from './patient'

// Hybrid Option 2 Outer Clinical Shell (Epic Hyperspace layout):
// 1) Top Bird's-Eye Workqueue Ribbon (Full Workqueue View + Patient Quick-Switcher + Live Counts + Batch Approve)
// 2) Full-Height Left Epic Storyboard (260px) anchored at top-left
// 3) Side-by-side Center 3-Tab Workspace + Right Source Chart
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

function ageFromDob(dob?: string): string | null {
  if (!dob) return null
  const m = dob.match(/(\d{4})$/)
  if (!m) return null
  const age = 2026 - Number(m[1])
  return age >= 0 && age <= 120 ? `${age}` : null
}

export function PatientProfile({
  patient,
  scenario,
  activeScenarioId,
  clients,
  onSelectClient,
  onSelectCase,
  onBackToQueue,
  onBatchApproveReady,
  onInspectInBuild,
  workspace,
}: {
  patient: Patient
  scenario: ScenarioConfig
  activeScenarioId: string
  clients: Client[]
  onSelectClient: (id: number) => void
  onSelectCase: (scenarioId: string) => void
  onBackToQueue: () => void
  onBatchApproveReady?: () => void
  onInspectInBuild?: (scenarioId: string) => void
  workspace: ReactNode
}) {
  const profile = patientProfiles[patient.patientRef]
  const history = profile?.paHistory ?? []
  const diagnoses = profile?.clinical?.diagnoses ?? [{ code: '', label: scenario.diagnosis }]
  const medications = profile?.clinical?.medications ?? []
  const trials = profile?.trials ?? []
  const allergies = profile?.clinical?.allergies ?? ['NKDA']
  const activeClient = clients.find(c => c.scenarioId === activeScenarioId) ?? patient.cases[0]

  const exceptionCount = clients.filter(c => c.status === 'exception').length
  const payerCount = clients.filter(c => c.status === 'payer_response').length
  const readyCount = clients.filter(c => c.status === 'ready_for_review').length

  const currentIdx = clients.findIndex(c => c.scenarioId === activeScenarioId)
  const nextClient = clients.length > 1 ? clients[(currentIdx + 1) % clients.length] : null
  const ageStr = ageFromDob(patient.dob)
  const sexStr = scenario.patientContext?.patientSex

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Top Bird's-Eye PA Workqueue Ribbon */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-950 shrink-0 space-y-1.5">
        {/* Row 1: Full Workqueue button + Quick-Switch Patient Chips + Next Case + Inspect in Build */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBackToQueue}
            aria-label="Back to Queue"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors shrink-0"
          >
            <LayoutList className="w-3.5 h-3.5 text-slate-400" />
            Full Workqueue View
          </button>

          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto justify-end">
            {clients.map(c => {
              const active = c.scenarioId === activeScenarioId
              const shortDrug = c.drug.split(' ')[0]
              const isReady = c.status === 'ready_for_review'
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectClient(c.id)}
                  title={`${c.patientDisplayName ?? c.name} — ${c.drug} (${c.deadline})`}
                  className={[
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap border transition-all shrink-0',
                    active
                      ? 'bg-blue-500/10 border-blue-500/60 text-slate-100 font-semibold shadow-sm'
                      : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700',
                  ].join(' ')}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[c.status]}`} />
                  <span>{lastNameOnly(c.patientDisplayName ?? c.name)} · {shortDrug}</span>
                  {active && <span className="text-[11px] text-blue-400">(Active)</span>}
                  {!active && isReady && <span className="text-emerald-400 font-bold">✓</span>}
                </button>
              )
            })}
            {nextClient && (
              <button
                onClick={() => onSelectClient(nextClient.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
              >
                Next Case <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Live Bird's-Eye Tally + Batch Approve + Inspect in Build */}
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
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> {readyCount} Ready to File
            </span>
            {readyCount > 0 && onBatchApproveReady && (
              <button
                onClick={onBatchApproveReady}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition-colors"
              >
                Batch Approve
                <span className="px-1.5 py-0 rounded-full bg-emerald-500/20 text-[11px] font-bold">{readyCount}</span>
              </button>
            )}
          </div>

          {onInspectInBuild && (
            <button
              onClick={() => onInspectInBuild(activeScenarioId)}
              title="Open this case's PII-redacted tokenizer & Codex evals trace in Build mode"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              Inspect in Build
            </button>
          )}
        </div>
      </div>

      {/* 3-Column Epic Clinical Layout: Full-Height Storyboard + 2-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Column 1: Full-Height Left Epic Storyboard */}
        <aside className="w-64 shrink-0 border-r border-slate-800 epic-storyboard bg-slate-900/40 overflow-y-auto p-4 space-y-4">
          {/* Centered Epic Patient Identity Header */}
          <div className="pb-3.5 border-b border-slate-800 text-center space-y-1.5">
            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center mx-auto">
              <User className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wide leading-tight pt-1">
              {patient.displayName}{ageStr ? `, ${ageStr}${sexStr && sexStr !== '—' ? sexStr : ''}` : ''}
            </h2>
            <div className="text-xs text-slate-400 space-y-0.5">
              {patient.dob && <p>DOB {patient.dob} · <span className="font-mono">{patient.patientRef}</span></p>}
              <p className="leading-snug">{scenario.plan} · {scenario.planId}</p>
            </div>
            {activeClient && (
              <div className="pt-1 flex flex-col items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  SLA Clock: {activeClient.deadline}
                </span>
                <StageBadge stage={getCaseStage(activeClient)} />
              </div>
            )}
          </div>

          {/* Active Problems */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-200">Active Problems</p>
            <div className="space-y-1 text-xs text-slate-300 leading-snug">
              {diagnoses.map((d, i) => (
                <p key={i}>
                  {d.label} {d.code && <span className="font-mono text-slate-400">({d.code})</span>}
                </p>
              ))}
            </div>
          </div>

          {/* Step-Therapy Trials & Medications */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-200">Step-Therapy Trials</p>
              {profile?.compliance && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700">
                  PDC {profile.compliance.pdc}
                </span>
              )}
            </div>
            <div className="space-y-1 text-xs text-slate-300 leading-snug">
              {trials.length > 0 ? (
                trials.slice(0, 2).map((t, i) => (
                  <p key={i} className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><span className="font-mono text-[11px] text-slate-400">{t.date}</span> · {t.therapy} ({t.supply})</span>
                  </p>
                ))
              ) : medications.slice(0, 2).map((m, i) => (
                <p key={i}>{m.name} · {m.sig}</p>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-200">Allergies</p>
            <p className="text-xs text-slate-300 leading-snug">{allergies.join(', ')}</p>
          </div>

          {/* PA History */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <p className="text-xs font-bold text-slate-200">PA History</p>
            <div className="space-y-1.5">
              {patient.cases.map(c => {
                const active = c.scenarioId === activeScenarioId
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectCase(c.scenarioId)}
                    className={[
                      'w-full text-left rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                      active
                        ? 'epic-card border-blue-500/50 text-slate-100 font-semibold'
                        : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{c.drug.split(' ')[0]} (Current)</span>
                      <StatusBadge status={c.status} />
                    </div>
                  </button>
                )
              })}
              {history.map((h, i) => (
                <div key={i} className="text-xs text-slate-400 px-1 flex items-center justify-between gap-1">
                  <span className="truncate">{h.drug}</span>
                  <span className="text-emerald-400 shrink-0 capitalize">{h.decision}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Columns 2 & 3: Center Activity Canvas + Right Source Chart */}
        <div className="flex-1 flex overflow-hidden min-w-0">
          {workspace}
        </div>
      </div>
    </div>
  )
}
