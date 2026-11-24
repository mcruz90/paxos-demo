import { ArrowRight, Clock } from 'lucide-react'
import { getCaseStage, scenarios } from '../../data/scenarios'
import { type CaseAssessment } from '../../lib/wire'
import { type Client } from '../../types'
import { DueBadge, InfoHint, StageBadge, StatusBadge, TargetBadge } from '../ui'
import { buildAssessmentView } from './caseAssessment'
import { type ActionGroup, type StageFilter, type UrgencyFilter, countActionable, tourIdFor } from './caseQueue'
import { QueueFilterBar } from './QueueFilterBar'
import { resolveRegulatoryClock } from './regulatoryClocks'

function ctaForStatus(status: Client['status']): { label: string; cls: string } {
  if (status === 'exception') return { label: 'Resolve Exception', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35 group-hover:bg-amber-500/25' }
  if (status === 'payer_response') return { label: 'Respond to Offer', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/35 group-hover:bg-violet-500/25' }
  if (status === 'ready_for_review') return { label: 'Review & Sign Off', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 group-hover:bg-emerald-500/25' }
  return { label: 'Open Chart', cls: 'bg-slate-800/70 text-slate-300 border-slate-700 group-hover:border-slate-500' }
}

function KpiStrip({ clients }: { clients: Client[] }) {
  const actionableCount = countActionable(clients)
  const dueTodayCount = clients.filter(c => c.urgency === 'today').length
  const readyCount = clients.filter(c => c.status === 'ready_for_review').length
  const cards = [
    { label: 'Total Roster', value: clients.length, sub: 'Fixture queue synced', tone: 'text-slate-100' },
    { label: 'Needs Action', value: actionableCount, sub: 'Awaiting coordinator review', tone: actionableCount > 0 ? 'text-amber-300' : 'text-slate-100' },
    { label: 'Due Today · Queue Target', value: dueTodayCount, sub: 'Per-plan decision clocks (when verified)', tone: dueTodayCount > 0 ? 'text-red-300' : 'text-slate-100' },
    { label: 'Ready for Sign-Off', value: readyCount, sub: 'Checklist addressed', tone: readyCount > 0 ? 'text-emerald-300' : 'text-slate-100' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {cards.map(card => (
        <div key={card.label} className="epic-card rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <p className={`text-2xl font-bold font-display leading-none ${card.tone}`}>{card.value}</p>
            <span className="text-[11px] text-slate-500 truncate">{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function QueueRow({
  client,
  selected,
  resolved,
  assessment,
  onSelect,
}: {
  client: Client
  selected: boolean
  resolved: boolean
  assessment?: CaseAssessment
  onSelect: (id: number) => void
}) {
  const scenario = scenarios[client.scenarioId]
  const wired = assessment ? buildAssessmentView(assessment) : null
  const totalCrit = wired ? wired.totalCount : (scenario?.criteriaResults.length ?? 0)
  const metCrit = wired ? wired.metCount : (scenario?.criteriaResults.filter(r => r.status === 'found').length ?? 0)
  const pct = totalCrit > 0 ? Math.round((metCrit / totalCrit) * 100) : 0
  const cta = ctaForStatus(client.status)
  const clock = resolveRegulatoryClock(client, scenario)
  const borderAccent = client.urgency === 'today' ? 'border-l-4 border-l-red-500' : client.urgency === 'soon' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-slate-700'
  const progressLine = wired
    ? `${wired.readyLabel}${wired.blockers.length > 0 ? ` · Blockers: ${wired.blockers.join(', ')}` : ''}${wired.nextAction ? ` · ${wired.nextAction}` : ''}`
    : client.gapSummary

  return (
    <button
      id={tourIdFor(client)}
      type="button"
      onClick={() => onSelect(client.id)}
      className={`group w-full text-left px-4 py-3.5 transition-colors grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-center ${borderAccent} ${selected ? 'bg-slate-800/80' : 'epic-card bg-slate-900/30 hover:bg-slate-800/40'}`}
    >
      <div className="lg:col-span-2 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-white truncate">{client.patientDisplayName ?? client.name}</p>
          {resolved && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Exceptions resolved locally" />}
        </div>
        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
          {client.name}{client.patientRef ? ` · ${client.patientRef}` : ''}
        </p>
      </div>
      <div className="lg:col-span-2 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-200 truncate">{client.drug}</p>
          <TargetBadge target={client.paTargetType} />
        </div>
        <p className="text-xs text-slate-400 truncate mt-0.5">{scenario?.diagnosis ?? client.categoryLabel}</p>
      </div>
      <div className="lg:col-span-2 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{client.payer ?? scenario?.plan}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <StageBadge stage={getCaseStage(client)} />
          <StatusBadge status={client.status} />
        </div>
      </div>
      <div className="lg:col-span-2 min-w-0 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-semibold text-slate-300">
            {wired ? `${metCrit}/${totalCrit} Met` : `${metCrit}/${totalCrit} Addressed`}
          </span>
          <span className="text-[11px] text-slate-500">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full ${metCrit === totalCrit && totalCrit > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {progressLine && <p className="text-[11px] text-slate-400 truncate" title={progressLine}>{progressLine}</p>}
      </div>
      <div className="lg:col-span-2 min-w-0 space-y-1">
        <DueBadge deadline={client.deadline} urgency={client.urgency} />
        <p className="text-[10px] text-slate-500 flex items-start gap-1 leading-tight">
          <Clock className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="leading-tight" title={clock.authority}>{clock.authority} · {clock.windowLabel}</span>
        </p>
      </div>
      <div className="lg:col-span-2 flex lg:justify-end">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${cta.cls}`}>
          {cta.label} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </button>
  )
}

export function CaseQueueColumn({
  clients, groups, search, setSearch, filterStage, setFilterStage, filterUrgency, setFilterUrgency, selectedId, onSelect, isClientExceptionsResolved, assessmentsByScenario,
}: {
  clients: Client[]; groups: ActionGroup[]; search: string; setSearch: (v: string) => void
  filterStage: StageFilter; setFilterStage: (v: StageFilter) => void
  filterUrgency: UrgencyFilter; setFilterUrgency: (v: UrgencyFilter) => void
  selectedId: number | null; onSelect: (id: number) => void; isClientExceptionsResolved: (client: Client) => boolean
  assessmentsByScenario?: Record<string, CaseAssessment>
}) {
  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'

  return (
    <div id="tour-portfolio-list" className="flex-1 w-full overflow-y-auto p-6 bg-slate-950/30">
      <div className="max-w-7xl mx-auto">
        <QueueFilterBar search={search} setSearch={setSearch} filterStage={filterStage} setFilterStage={setFilterStage} filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency} />
        <KpiStrip clients={clients} />
        {groups.length === 0 ? (
          <p className="text-center py-12 text-slate-500 text-sm">
            {search || hasActiveFilters ? 'No cases match the current filters' : 'No cases in the queue'}
          </p>
        ) : (
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.status} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-300">{group.label}</span>
                  <span className="text-xs text-slate-500 font-mono">{group.rows.length}</span>
                  <InfoHint text={group.hint} wide />
                </div>
                <div className="rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80">
                  <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-2 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <div className="col-span-2">Patient &amp; Case</div>
                    <div className="col-span-2">Medication &amp; Diagnosis</div>
                    <div className="col-span-2">Payer &amp; Stage</div>
                    <div className="col-span-2">Criteria Readiness</div>
                    <div className="col-span-2">Decision Clock</div>
                    <div className="col-span-2 text-right">Action</div>
                  </div>
                  {group.rows.map(client => (
                    <QueueRow key={client.id} client={client} selected={selectedId === client.id} resolved={isClientExceptionsResolved(client)} assessment={assessmentsByScenario?.[client.scenarioId]} onSelect={onSelect} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
