import { useEffect, useRef } from 'react'
import { BookmarkPlus, FileText } from 'lucide-react'
import { type ScenarioConfig } from '../../types'

// Right pane: verbatim EHR evidence behind each criterion, synced with the
// hovered/selected criterion in the workspace.
export function CitationPane({
  scenario,
  highlightedIndex,
  onSelectIndex,
}: {
  scenario: ScenarioConfig
  highlightedIndex: number | null
  onSelectIndex: (idx: number | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (highlightedIndex !== null && containerRef.current) {
      const activeEl = containerRef.current.querySelector(`[data-cite-index="${highlightedIndex}"]`)
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  return (
    <div className="w-[340px] shrink-0 border-l border-slate-800 bg-slate-900/20 flex flex-col overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-800/40 shrink-0">
        <div className="flex items-center gap-2">
          <BookmarkPlus className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-200">Citation Ground Truth</h3>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Quoted evidence directly from the EHR record</p>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {scenario.criteriaResults.map((cr, idx) => {
          const cite = scenario.citations[cr.rule.label]
          const isHighlighted = highlightedIndex === idx

          return (
            <div
              key={idx}
              data-cite-index={idx}
              onClick={() => onSelectIndex(isHighlighted ? null : idx)}
              className={[
                'rounded-xl border p-3 transition-all cursor-pointer text-left',
                isHighlighted
                  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800/20 border-slate-800 hover:border-slate-700/60',
              ].join(' ')}
            >
              <div className="flex items-start gap-1.5 mb-2">
                <span className={`text-[11px] font-bold mt-0.5 shrink-0 transition-colors ${isHighlighted ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {idx + 1}
                </span>
                <h4 className={`text-xs font-semibold leading-tight transition-colors ${isHighlighted ? 'text-white' : 'text-slate-300'}`}>
                  {cr.rule.label}
                </h4>
              </div>

              {cr.status === 'conflict' && cr.conflictSources ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 space-y-2.5">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">🚨 EHR Contradiction</p>
                  <div className="space-y-2 divide-y divide-red-500/10">
                    {cr.conflictSources.map((cs, sIdx) => (
                      <div key={sIdx} className="pt-2 first:pt-0">
                        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 uppercase">
                          <FileText className="w-2.5 h-2.5" />
                          <span>{cs.source}</span>
                        </div>
                        <p className="text-[11px] text-slate-200 italic mt-0.5 leading-normal">
                          &ldquo;{cs.claim}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : cite ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span className="truncate">{cite.source}</span>
                    <span>·</span>
                    <span>{cite.page}</span>
                  </div>
                  <p className={[
                    'text-xs italic leading-relaxed rounded px-2 py-1.5 transition-colors border',
                    isHighlighted
                      ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-200'
                      : 'bg-emerald-950/30 border-emerald-950 text-slate-400',
                  ].join(' ')}>
                    &ldquo;{cite.text}&rdquo;
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic pl-3 leading-relaxed">
                  Supporting evidence verified in clinical record
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
