import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { CitationPane } from './CitationPane'
import { type PhiDictionary } from './redaction'
import { SourceDocViewer } from './SourceDocViewer'

// Col 3 of the split view: the collapsible evidence pane — rendered source
// documents (when the case authored them) or the citation snippet cards, with
// the vertical toggle handle. View state lives in the parent so criterion
// clicks and the Documents vault can drive it.
export function EvidencePane({
  scenario,
  phi,
  showCitations,
  onToggleCitations,
  citeView,
  setCiteView,
  activeCiteIndex,
  onSelectCiteIndex,
  activeDocId,
  onSelectDoc,
}: {
  scenario: ScenarioConfig
  phi: PhiDictionary | null
  showCitations: boolean
  onToggleCitations: () => void
  citeView: 'source' | 'citations'
  setCiteView: (v: 'source' | 'citations') => void
  activeCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  activeDocId: string | null
  onSelectDoc: (docId: string | null) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden">
      <button
        onClick={onToggleCitations}
        title={showCitations ? 'Hide citations' : 'Show citations'}
        className="w-6 shrink-0 border-l border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
      >
        {showCitations ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
          Citations
        </span>
      </button>
      <div className={`border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${showCitations ? 'w-[640px]' : 'w-0'}`}>
        {scenario.sourceDocuments?.length ? (
          <div className="flex gap-1 p-2 border-b border-slate-800 shrink-0">
            {([
              { view: 'source' as const,    label: 'Source Doc' },
              { view: 'citations' as const, label: 'Citations'  },
            ]).map(({ view, label }) => (
              <button
                key={view}
                onClick={() => setCiteView(view)}
                className={[
                  'flex-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border',
                  citeView === view
                    ? 'bg-slate-800 border-slate-700 text-emerald-300'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex-1 min-h-0 w-[640px]">
          {scenario.sourceDocuments?.length && citeView === 'source' ? (
            <SourceDocViewer
              scenario={scenario}
              activeCiteIndex={activeCiteIndex}
              activeDocId={activeDocId}
              onSelectDoc={onSelectDoc}
              phi={phi}
            />
          ) : (
            <CitationPane
              scenario={scenario}
              highlightedIndex={activeCiteIndex}
              onSelectIndex={onSelectCiteIndex}
            />
          )}
        </div>
      </div>
    </div>
  )
}
