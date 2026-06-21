import { FileText, BookmarkPlus } from 'lucide-react'
import { usePoc } from './PocContext'

// Right-hand "every claim maps to a source" panel. Shared by the appeal letter
// review (ReviewPanel) and the initial-PA request review (PaRequestReviewPanel):
// both bind each criterion to its citation and cross-highlight on hover via the
// shared hoveredCite state in PocContext.
export function CitationGroundTruth({ id }: { id?: string }) {
  const { scenario, hoveredCite, setHoveredCite } = usePoc()
  return (
    <div id={id} className="w-72 shrink-0 sticky top-4">
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-800/60">
          <div className="flex items-center gap-2 mb-0.5">
            <BookmarkPlus className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm font-semibold text-slate-200">Citation Ground Truth</p>
          </div>
          <p className="text-xs text-slate-500">Every claim maps to a source document</p>
        </div>
        <div className="divide-y divide-slate-700/40">
          {scenario.criteriaResults.map((cr, i) => {
            const cite = scenario.citations[cr.rule.label]
            const active = hoveredCite === i
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredCite(i)}
                onMouseLeave={() => setHoveredCite(null)}
                className={`px-4 py-3 transition-colors cursor-default ${active ? 'bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/40' : ''}`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className={`text-xs font-bold mt-0.5 shrink-0 transition-colors ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{i + 1}</span>
                  <p className={`text-xs font-medium leading-snug transition-colors ${active ? 'text-white' : 'text-slate-300'}`}>{cr.rule.label}</p>
                </div>
                {cite ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>{cite.source}</span>
                      <span className="text-slate-700">·</span>
                      <span>{cite.page}</span>
                    </div>
                    <p className={`text-xs italic text-emerald-300/80 rounded px-2.5 py-1.5 leading-relaxed transition-all ${
                      active ? 'bg-emerald-950/80 border border-emerald-400/50' : 'bg-emerald-950/40 border border-emerald-500/20'
                    }`}>
                      &ldquo;{cite.text}&rdquo;
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-4">Supporting documentation confirmed</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
