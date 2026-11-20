import { Search, X } from 'lucide-react'
import { type StageFilter, type UrgencyFilter } from './caseQueue'

// Search box + stage/urgency filter chips for the full-width workqueue.
// Default ("All stages", "Any urgency") stay quiet neutral slate so accent colors
// only highlight actively applied filters.
export function QueueFilterBar({
  search, setSearch,
  filterStage, setFilterStage,
  filterUrgency, setFilterUrgency,
}: {
  search: string
  setSearch: (q: string) => void
  filterStage: StageFilter
  setFilterStage: (f: StageFilter) => void
  filterUrgency: UrgencyFilter
  setFilterUrgency: (f: UrgencyFilter) => void
}) {
  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all' || search.trim().length > 0

  return (
    <div className="pb-4 mb-5 border-b border-slate-800/70 shrink-0 flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[260px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search patients, MRN, drugs, payers..."
          className="pl-9 pr-3 py-2 w-full bg-slate-800/60 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {([
          { value: 'all',        label: 'All stages' },
          { value: 'initial_pa', label: 'Initial PA' },
          { value: 'appeal',     label: 'Appeal'     },
        ] as const).map(({ value, label }) => {
          const active = filterStage === value
          const cls = active
            ? value === 'all'
              ? 'bg-slate-800 border-slate-600 text-slate-100 font-semibold'
              : 'bg-blue-500/15 border-blue-500/40 text-blue-300 font-semibold'
            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          return (
            <button
              key={value}
              onClick={() => setFilterStage(value)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${cls}`}
            >
              {label}
            </button>
          )
        })}

        <span className="h-4 w-px bg-slate-700/60 mx-1" />

        {([
          { value: 'all',   label: 'Any urgency' },
          { value: 'today', label: 'Due today'   },
          { value: 'soon',  label: 'Due soon'    },
        ] as const).map(({ value, label }) => {
          const active = filterUrgency === value
          const cls = active
            ? value === 'all'
              ? 'bg-slate-800 border-slate-600 text-slate-100 font-semibold'
              : value === 'today'
                ? 'bg-red-500/15 border-red-500/40 text-red-300 font-semibold'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          return (
            <button
              key={value}
              onClick={() => setFilterUrgency(value)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${cls}`}
            >
              {label}
            </button>
          )
        })}

        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setFilterStage('all'); setFilterUrgency('all') }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />Clear
          </button>
        )}
      </div>
    </div>
  )
}
