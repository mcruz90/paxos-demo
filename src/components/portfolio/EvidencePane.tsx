import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { CitationPane } from './CitationPane'
import { type PhiDictionary } from './redaction'
import { defaultDocId, ensureSourceDocuments } from './sourceDocuments'
import { SourceDocViewer } from './SourceDocViewer'

// Col 3 of the split view: single unified header bar (Document Switcher dropdown
// + Source Chart / Criteria Snippets toggle) above the chart or excerpt cards.
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
  const docs = ensureSourceDocuments(scenario)
  const shownDocId = activeDocId ?? defaultDocId(docs) ?? ''

  return (
    <div className="flex shrink-0 overflow-hidden">
      <button
        onClick={onToggleCitations}
        title={showCitations ? 'Hide source chart' : 'Show source chart'}
        className="w-6 shrink-0 border-l border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
      >
        {showCitations ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
          Source Chart
        </span>
      </button>
      <div className={`border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${showCitations ? 'w-[420px] xl:w-[480px]' : 'w-0'}`}>
        {/* Single compact header bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/40 shrink-0">
          {citeView === 'source' && docs.length > 0 ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Switch source document"
                value={shownDocId}
                onChange={e => onSelectDoc(e.target.value)}
                className="w-full max-w-[240px] bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {docs.map((doc, idx) => (
                  <option key={doc.id} value={doc.id}>
                    Doc {idx + 1}/{docs.length}: {doc.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-300 truncate">Criteria Evidence Snippets</span>
          )}

          {docs.length > 0 && (
            <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-950 border border-slate-800 p-0.5 shrink-0">
              {([
                { view: 'source' as const,    label: 'Chart' },
                { view: 'citations' as const, label: 'Snippets' },
              ]).map(({ view, label }) => (
                <button
                  key={view}
                  onClick={() => setCiteView(view)}
                  className={[
                    'px-2 py-1 rounded text-[11px] font-semibold transition-colors',
                    citeView === view
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 w-[420px] xl:w-[480px]">
          {docs.length && citeView === 'source' ? (
            <SourceDocViewer
              scenario={scenario}
              activeCiteIndex={activeCiteIndex}
              activeDocId={activeDocId}
              onSelectDoc={onSelectDoc}
              phi={phi}
              forcePlane="operate"
              compactHeader
            />
          ) : (
            <CitationPane
              scenario={scenario}
              highlightedIndex={activeCiteIndex}
              onSelectIndex={onSelectCiteIndex}
              compactHeader
            />
          )}
        </div>
      </div>
    </div>
  )
}
