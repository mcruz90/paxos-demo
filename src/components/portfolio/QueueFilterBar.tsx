import { Search, X } from 'lucide-react'
import { type StageFilter, type UrgencyFilter } from './caseQueue'

// Search box + stage/urgency filter chips for the case queue.
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
  const hasActiveFilters = filterStage !== 'all' || filterUrgency !== 'all'

  return (
    <div className="px-6 pt-4 pb-2 shrink-0">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search patients, drugs, payers..."
            className="pl-9 pr-3 py-2 w-64 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="h-5 w-px bg-slate-700/60" />
        <div className="flex items-center gap-1.5">
          {([
            { value: 'all',        label: 'All stages' },
            { value: 'initial_pa', label: 'Initial PA' },
            { value: 'appeal',     label: 'Appeal'     },
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
        <div className="flex items-center gap-1.5">
          {([
            { value: 'all',   label: 'Any urgency' },
            { value: 'today', label: 'Due today'   },
            { value: 'soon',  label: 'Due soon'    },
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
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterStage('all'); setFilterUrgency('all') }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />Clear
          </button>
        )}
      </div>
    </div>
  )
}
