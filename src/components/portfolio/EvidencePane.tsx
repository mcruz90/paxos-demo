import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { type CaseAssessment } from '../../lib/wire'
import { type ScenarioConfig } from '../../types'
import { buildAssessmentSourceDocs } from './assessmentEvidence'
import { AssessmentEvidenceRailBody } from './AssessmentEvidenceView'
import { CitationPane } from './CitationPane'
import { type CaseDiscoveryRailProps, DiscoveryEvidencePanel } from './DiscoveryEvidencePanel'
import { type PhiDictionary } from './redaction'
import { defaultDocId, ensureSourceDocuments } from './sourceDocuments'
import { SourceDocViewer } from './SourceDocViewer'

export type EvidenceRailView = 'source' | 'citations' | 'discovery'

// Col 3 of the split view: single unified header bar (Document Switcher dropdown
// + Source Chart / Criteria Snippets / Discover toggle) above the rail body.
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
  assessment,
  sourceBodies,
  discovery,
}: {
  scenario: ScenarioConfig
  phi: PhiDictionary | null
  showCitations: boolean
  onToggleCitations: () => void
  citeView: EvidenceRailView
  setCiteView: (v: EvidenceRailView) => void
  activeCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  activeDocId: string | null
  onSelectDoc: (docId: string | null) => void
  assessment?: CaseAssessment | null
  sourceBodies?: Record<string, string>
  discovery?: CaseDiscoveryRailProps
}) {
  const docs = ensureSourceDocuments(scenario)
  const wiredDocs = assessment ? buildAssessmentSourceDocs(assessment, sourceBodies) : null
  const activeCriterionId = assessment && activeCiteIndex !== null
    ? assessment.findings[activeCiteIndex]?.criterion_id ?? null
    : null
  const shownDocId = wiredDocs
    ? (activeDocId && wiredDocs.some(d => d.sourceVersionId === activeDocId) ? activeDocId : wiredDocs[0]?.sourceVersionId ?? '')
    : (activeDocId ?? defaultDocId(docs) ?? '')
  const docCount = wiredDocs ? wiredDocs.length : docs.length

  return (
    <div className="flex shrink-0 overflow-hidden">
      <button
        type="button"
        onClick={onToggleCitations}
        aria-expanded={showCitations}
        title={showCitations ? 'Hide source chart' : 'Show source chart'}
        className="w-6 shrink-0 border-l border-slate-800 bg-slate-900/40 hover:bg-slate-800 flex flex-col items-center gap-2 py-3 text-slate-400 hover:text-emerald-300 transition-colors"
      >
        {showCitations ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-wider">
          Source Chart
        </span>
      </button>
      <div className={`border-l border-slate-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${showCitations ? 'w-[360px] 2xl:w-[440px]' : 'w-0'}`}>
        {/* Single compact header bar */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/40 shrink-0">
          {citeView === 'source' && docCount > 0 ? (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                aria-label="Switch source document"
                value={shownDocId}
                onChange={e => onSelectDoc(e.target.value)}
                className="w-full max-w-[240px] bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {wiredDocs
                  ? wiredDocs.map((doc, idx) => (
                      <option key={doc.sourceVersionId} value={doc.sourceVersionId}>
                        Doc {idx + 1}/{wiredDocs.length}: {doc.sourceVersionId}
                      </option>
                    ))
                  : docs.map((doc, idx) => (
                      <option key={doc.id} value={doc.id}>
                        Doc {idx + 1}/{docs.length}: {doc.title}
                      </option>
                    ))}
              </select>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-300 truncate">
              {citeView === 'discovery' ? 'Evidence Discovery' : 'Criteria Evidence Snippets'}
            </span>
          )}

          {(docCount > 0 || discovery) && (
            <div className="inline-flex items-center gap-0.5 rounded-md bg-slate-950 border border-slate-800 p-0.5 shrink-0">
              {([
                { view: 'source' as const, label: 'Chart' },
                { view: 'citations' as const, label: 'Snippets' },
                ...(discovery
                  ? [{
                      view: 'discovery' as const,
                      label: discovery.attachments.length > 0 ? `Discover (${discovery.attachments.length})` : 'Discover',
                    }]
                  : []),
              ]).map(({ view, label }) => (
                <button
                  key={view}
                  type="button"
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

        <div className="flex-1 min-h-0 w-[360px] 2xl:w-[440px]">
          {discovery && citeView === 'discovery' ? (
            <DiscoveryEvidencePanel discovery={discovery} sourceBodies={sourceBodies} />
          ) : assessment && citeView === 'source' ? (
            <AssessmentEvidenceRailBody
              assessment={assessment}
              activeCriterionId={activeCriterionId}
              activeSourceVersionId={shownDocId || null}
              sourceBodies={sourceBodies}
              onOpenDiscovery={discovery ? () => setCiteView('discovery') : undefined}
            />
          ) : docCount && citeView === 'source' ? (
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
              assessment={assessment}
            />
          )}
        </div>
      </div>
    </div>
  )
}
