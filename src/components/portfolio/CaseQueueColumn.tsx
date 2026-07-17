import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type Client } from '../../types'
import { InfoHint } from '../ui'
import {
  type ActionGroup,
  type StageFilter,
  type UrgencyFilter,
  countActionable,
  tourIdFor,
} from './caseQueue'
import { CaseCard } from './CaseCard'
import { QueueFilterBar } from './QueueFilterBar'

// Col 1 of the split view: filter bar, roster stat strip, and the grouped case
// list — collapses once a case is open (focus mode); the persistent handle to
// its right slides it back in. Selection and filter state live in the parent.
export function CaseQueueColumn({
  clients,
  groups,
  search, setSearch,
  filterStage, setFilterStage,
  filterUrgency, setFilterUrgency,
  selectedId,
  onSelect,
  hasOpenCase,
  showCaseList,
  onToggleCaseList,
  isClientExceptionsResolved,
}: {
  clients: Client[]
  groups: ActionGroup[]
  search: string
  setSearch: (v: string) => void
  filterStage: StageFilter
  setFilterStage: (v: StageFilter) => void
  filterUrgency: UrgencyFilter
  setFilterUrgency: (v: UrgencyFilter) => void
  selectedId: number | null
  onSelect: (id: number) => void
  hasOpenCase: boolean
  showCaseList: boolean
  onToggleCaseList: () => void
  isClientExceptionsResolved: (client: Client) => boolean
}) {
  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'
  const actionableCount  = countActionable(clients)
  const dueTodayCount    = clients.filter(c => c.urgency === 'today').length

  return (
    <div className="flex shrink-0 overflow-hidden">
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showCaseList ? 'w-[430px]' : 'w-0'}`}>
        <div
          id="tour-portfolio-list"
          className="w-[430px] h-full border-r border-slate-800 overflow-y-auto p-4 bg-slate-950/40"
        >
          {/* Search + filters govern the roster, so they live inside it */}
          <QueueFilterBar
            search={search} setSearch={setSearch}
            filterStage={filterStage} setFilterStage={setFilterStage}
            filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
          />

          {/* Roster stat strip — all counts derived from the live client list.
              Deliberately NO fabricated "approval %": that needs a real audit
              aggregate (/api/audit/records), which the demo doesn't have yet. */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {([
              { label: 'Total roster', value: clients.length,   tone: 'text-slate-100' },
              { label: 'Needs action', value: actionableCount,  tone: actionableCount > 0 ? 'text-amber-300' : 'text-slate-100' },
              { label: 'Due today',    value: dueTodayCount,     tone: dueTodayCount > 0 ? 'text-red-300' : 'text-slate-100' },
            ]).map(({ label, value, tone }) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5 text-center">
                <p className={`text-lg font-bold font-display leading-none ${tone}`}>{value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-1.5">{label}</p>
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="text-center py-12 text-slate-500 text-sm">
              {search || hasActiveFilters ? 'No cases match the current filters' : 'No cases in the queue'}
            </p>
          ) : (
            groups.map(group => (
              <div key={group.status} className="mb-6">
                <div className="flex items-center gap-2 px-2 py-1 mb-2">
                  <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                  <span className="text-xs text-slate-600 font-mono">{group.rows.length}</span>
                  <InfoHint text={group.hint} wide />
                </div>
                <div className="space-y-2.5">
                  {group.rows.map(client => (
                    <CaseCard
                      key={client.id}
                      client={client}
                      selected={selectedId === client.id}
                      onClick={() => onSelect(client.id)}
                      tourId={tourIdFor(client)}
                      isResolved={isClientExceptionsResolved(client)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Reopen handle — shown only while a case is open, so there is
          something to focus on by hiding the queue. */}
      {hasOpenCase && (
        <button
          onClick={onToggleCaseList}
          title={showCaseList ? 'Hide queue' : 'Show queue'}
          className="w-6 shrink-0 border-r border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
        >
          {showCaseList ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
            Queue
          </span>
        </button>
      )}
    </div>
  )
}
