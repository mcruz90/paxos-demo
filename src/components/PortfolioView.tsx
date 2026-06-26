import { useState } from 'react'
import { Activity, ChevronRight, Building2, User, Search, ShieldCheck, X } from 'lucide-react'
import { type CaseStatus, type Client, type Urgency } from '../types'
import { getCaseStage, getCaseTier, TENANT } from '../data/scenarios'
import { InfoHint, StageBadge, StatusBadge, TierBadge, DueBadge } from './ui'

const ACTION_GROUPS: { status: CaseStatus; label: string; hint: string }[] = [
  { status: 'exception',        label: 'Needs investigation', hint: "AI hit a gap it can't resolve — gather what's missing" },
  { status: 'payer_response',   label: 'Respond to payer',    hint: 'Counter-offer received — review and file the next round' },
  { status: 'ready_for_review', label: 'Review & approve',    hint: 'AI work complete — review and authorize the send' },
  { status: 'submitted',        label: 'Awaiting payer',      hint: 'Filed — no action needed until the payer responds' },
  { status: 'processing',       label: 'Importing from Epic', hint: 'Syncing from the connected record' },
]

const URGENCY_ORDER: Record<Urgency, number> = { today: 0, soon: 1, later: 2 }

// Responsive grid: 4 cols default, +Stage/Tier at lg (1024px), +Category at xl (1280px)
const GRID = 'grid grid-cols-[2fr_1fr_1fr_120px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_120px] xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_120px]'

type StageFilter = 'all' | 'initial_pa' | 'appeal'
type UrgencyFilter = 'all' | 'today' | 'soon'

export function PortfolioView({ clients, onOpenCase, onStartTour }: {
  clients: Client[]
  onOpenCase: (scenarioId: string, status: CaseStatus) => void
  onStartTour: () => void
}) {
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<StageFilter>('all')
  const [filterUrgency, setFilterUrgency] = useState<UrgencyFilter>('all')
  const [showBanner, setShowBanner] = useState(true)

  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'
  const clearFilters = () => { setFilterStage('all'); setFilterUrgency('all') }

  const actionableCount = clients.filter(c => ['ready_for_review', 'exception', 'payer_response'].includes(c.status)).length
  const submittedCount = clients.filter(c => c.status === 'submitted').length

  const q = search.toLowerCase()
  const matches = clients.filter(c => {
    if (q && ![c.name, c.drug, c.categoryLabel].some(v => v.toLowerCase().includes(q))) return false
    if (filterStage !== 'all' && getCaseStage(c) !== (filterStage === 'initial_pa' ? 'Initial PA' : 'Appeal')) return false
    if (filterUrgency !== 'all' && c.urgency !== filterUrgency) return false
    return true
  })
  const byUrgency = (a: Client, b: Client) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
  const groups = ACTION_GROUPS
    .map(g => ({ ...g, rows: matches.filter(c => c.status === g.status).sort(byUrgency) }))
    .filter(g => g.rows.length > 0)

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
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
            {submittedCount > 0 && <><span className="text-slate-700">·</span><span className="text-slate-500 text-xs">{submittedCount} awaiting payer</span></>}
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40"
          title="Cases import automatically from Epic via FHIR Subscriptions the moment the record updates — no manual entry. Epic stays the source of truth; ClearAuth links the documents and writes the PA decision back."
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-slate-300">Auto-synced from Epic · live</span>
        </div>
      </div>

      {/* Welcome banner */}
      {showBanner && (
        <div className="mx-8 mt-5 mb-1 flex items-start gap-3 px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">First time here?</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              ClearAuth is an AI-native prior-authorization platform spanning the full PA lifecycle — initial prior auths, appeals, and determinations. The guided tours are split by audience: <span className="text-teal-300">Operate</span> (a prospective client), <span className="text-violet-300">Build</span> (evaluating the AI Lead), and <span className="text-sky-300">Scale</span> (an investor). Pick your path on the welcome screen.{' '}
              <span className="text-slate-500">All patients, cases, and clinical data are fictional — this is a portfolio prototype, not a production system.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={onStartTour}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
            >
              <Activity className="w-3.5 h-3.5" />
              Choose a tour
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-base leading-none px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Search + filter chips */}
      <div className="px-8 pt-5 pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Free-text search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients, drugs, categories..."
              className="pl-9 pr-3 py-2 w-64 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="h-5 w-px bg-slate-700/60" />

          {/* Stage filter */}
          <div className="flex items-center gap-1.5">
            {([
              { value: 'all',        label: 'All stages' },
              { value: 'initial_pa', label: 'Initial PA' },
              { value: 'appeal',     label: 'Appeal' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterStage(value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  filterStage === value
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-700/60" />

          {/* Urgency filter */}
          <div className="flex items-center gap-1.5">
            {([
              { value: 'all',   label: 'Any urgency' },
              { value: 'today', label: 'Due today' },
              { value: 'soon',  label: 'Due soon' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterUrgency(value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  filterUrgency === value
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>
      </div>

      {/* Case list */}
      <div className="px-8 py-4">
        {/* Column headers — responsive: Category hidden < lg, Stage + Tier hidden < md */}
        <div className={`${GRID} px-4 py-2 mb-1`}>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            Patient / Case
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            Drug
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide hidden xl:inline-flex items-center gap-1.5">
            Category
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:inline-flex items-center gap-1.5">
            Stage
            <InfoHint text="Where the case sits in the PA lifecycle — Initial PA (a new prior-auth request being assembled and filed) or Appeal (contesting a payer denial)." wide />
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5">
            Status
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:inline-flex items-center gap-1.5">
            Review Tier
            <InfoHint text="How much human oversight a case gets — Routine (AI resolves, quick approval), Complex (multi-round, closer review), or Exception (AI hit a gap and escalated to a person)." wide />
          </span>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide inline-flex items-center justify-end gap-1.5">
            Due
            <InfoHint text="Regulatory turnaround deadline. Standard PA decisions run on a fixed clock (expedited cases are shorter); the queue sorts the most urgent first." wide />
          </span>
        </div>

        <div id="tour-portfolio-list">
          {groups.map(group => (
            <div key={group.status} className="mb-5">
              <div className="flex items-baseline gap-2 px-4 pt-2 pb-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-200">{group.label}</span>
                <span className="text-xs text-slate-500 font-mono">{group.rows.length}</span>
                <span className="text-xs text-slate-600">· {group.hint}</span>
              </div>
              <div className="space-y-1">
                {group.rows.map(client => (
                  <div
                    key={client.id}
                    id={
                      client.scenarioId === 'novo-ozempic-initial' ? 'tour-case-initial-pa' :
                      client.scenarioId === 'novo-ozempic'         ? 'tour-case-ozempic' :
                      client.scenarioId === 'infant-omeprazole'    ? 'tour-case-infant' :
                      client.scenarioId === 'gilead-livdelzi'      ? 'tour-case-livdelzi' :
                      undefined
                    }
                    onClick={() => onOpenCase(client.scenarioId, client.status)}
                    className={`${GRID} items-center px-4 py-3.5 rounded-xl border transition-all group bg-slate-800/30 hover:bg-slate-800/70 border-transparent hover:border-slate-700/60 cursor-pointer`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg shrink-0 bg-slate-700 flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-sm font-medium text-white truncate">{client.name}</span>
                    </div>
                    <span className="text-sm text-slate-300 truncate">{client.drug}</span>
                    <span className="text-sm text-slate-400 hidden xl:block">{client.categoryLabel}</span>
                    <div className="hidden lg:flex"><StageBadge stage={getCaseStage(client)} /></div>
                    <div className="flex"><StatusBadge status={client.status} /></div>
                    <div className="hidden lg:flex"><TierBadge tier={getCaseTier(client)} /></div>
                    <div className="flex items-center justify-end gap-1.5">
                      <DueBadge deadline={client.deadline} urgency={client.urgency} />
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="text-center py-12 text-slate-500 text-sm">
              {search || hasActiveFilters
                ? 'No cases match the current filters'
                : 'No cases in the queue'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
