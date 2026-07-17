import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, FileText, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { presentationForSource } from './documentKindPresentation'
import { type PhiDictionary, redactBlocks } from './redaction'
import { RedactionLedger } from './RedactionLedger'
import { defaultDocId, findCitedBlock } from './sourceDocuments'

// Highlights redaction tokens ([REDACTED — …] / XX/XX/YYYY) so the Build plane
// reads as a de-identified document, not plain prose with odd words in it.
const REDACTION_SPLIT = /(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})/g
const REDACTION_TOKEN = /^(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})$/
function renderRedacted(text: string) {
  return text.split(REDACTION_SPLIT).map((part, i) =>
    REDACTION_TOKEN.test(part)
      ? <span key={i} className="font-mono text-[0.85em] text-red-600 bg-red-100 rounded px-1 py-0.5">{part}</span>
      : part,
  )
}

// Right-pane alternative to CitationPane: renders the actual source document on
// "paper" (same idiom as LetterPreview) with the cited span lit in situ. The
// active document is controlled by the parent so the Documents vault (middle
// pane) and a criterion click can both drive it; selecting a criterion switches
// to the document that grounds it and highlights the span.
export function SourceDocViewer({
  scenario,
  activeCiteIndex,
  activeDocId,
  onSelectDoc,
  phi,
}: {
  scenario: ScenarioConfig
  activeCiteIndex: number | null
  activeDocId: string | null
  onSelectDoc: (docId: string) => void
  // Redaction dictionary for the Build plane. Absent ⇒ no plane toggle.
  phi?: PhiDictionary | null
}) {
  const docs = scenario.sourceDocuments ?? []
  const bodyRef = useRef<HTMLDivElement>(null)
  // Which plane the reviewer is viewing as: Operate (full chart) or Build
  // (control plane — PHI redacted, ledger available). Resets per case.
  const [plane, setPlane] = useState<'operate' | 'build'>('operate')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  useEffect(() => { setPlane('operate'); setLedgerOpen(false) }, [scenario.id])

  // The criterion the reviewer is standing on → the block that grounds it.
  const activeLabel =
    activeCiteIndex !== null ? scenario.criteriaResults[activeCiteIndex]?.rule.label ?? null : null
  const activeCited = useMemo(
    () => (activeLabel ? findCitedBlock(docs, activeLabel) : null),
    [docs, activeLabel],
  )

  // A newly-selected criterion pulls the viewer to the document that cites it.
  useEffect(() => {
    if (activeCited) onSelectDoc(activeCited.docId)
  }, [activeCited]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownDocId = activeDocId ?? defaultDocId(docs)
  const activeDoc = docs.find(d => d.id === shownDocId) ?? docs[0] ?? null
  const litBlockIndex =
    activeCited && activeDoc && activeCited.docId === activeDoc.id ? activeCited.blockIndex : null

  // In the Build plane, redact the active document and surface the ledger.
  const isBuild = plane === 'build' && !!phi
  const { blocks: shownBlocks, ledger } = useMemo(() => {
    if (!activeDoc) return { blocks: [], ledger: [] }
    if (!isBuild || !phi) return { blocks: activeDoc.blocks, ledger: [] }
    return redactBlocks(activeDoc.blocks, phi)
  }, [activeDoc, isBuild, phi])

  // Keep the lit span in view once the right document is showing.
  useEffect(() => {
    if (litBlockIndex === null) return
    const el = bodyRef.current?.querySelector(`[data-block="${litBlockIndex}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [litBlockIndex, activeDoc?.id])

  return (
    <div className="w-full h-full bg-slate-900/20 flex flex-col overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-800/40 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-sm font-semibold text-slate-200">Source Documents</h3>
          </div>
          {phi && (
            <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5" title="View as the clinician (Operate) or the PHI-free control plane (Build)">
              {([
                { p: 'operate' as const, label: 'Operate' },
                { p: 'build' as const,   label: 'Build' },
              ]).map(({ p, label }) => (
                <button
                  key={p}
                  onClick={() => setPlane(p)}
                  className={[
                    'px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors',
                    plane === p
                      ? p === 'build' ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-100'
                      : 'text-slate-500 hover:text-slate-300',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">The patient record behind each citation</p>
      </div>

      {isBuild && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-violet-500/10 border-b border-violet-500/25 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-violet-200 leading-tight">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            Control plane — PHI-free by construction (ADR-0014)
          </span>
          <button
            onClick={() => setLedgerOpen(o => !o)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-violet-200 border border-violet-500/30 hover:bg-violet-500/15 transition-colors"
          >
            <Eye className="w-3 h-3" /> {ledgerOpen ? 'Hide' : 'Show'} Redaction Ledger
          </button>
        </div>
      )}

      {/* Document tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-800 overflow-x-auto shrink-0">
        {docs.map(doc => {
          const { Icon, tone } = presentationForSource(doc.source)
          const on = doc.id === activeDoc?.id
          return (
            <button
              key={doc.id}
              onClick={() => onSelectDoc(doc.id)}
              title={doc.title}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors border',
                on
                  ? 'bg-slate-800 border-slate-700 text-slate-100 font-semibold'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${on ? tone : ''}`} />
              <span className="max-w-[130px] truncate">{doc.title}</span>
            </button>
          )
        })}
      </div>

      {/* Paper — `paper` class keeps the un-inverted slate scale so the white
          page stays readable in light mode (same treatment as LetterPreview).
          `relative` anchors the redaction-ledger slide-over. */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 relative">
        {activeDoc ? (
          <div className="paper bg-white rounded-lg shadow-inner border border-slate-200 p-6 max-w-[640px] mx-auto text-slate-800">
            <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-200">
              {(() => {
                const { Icon, tone } = presentationForSource(activeDoc.source)
                return <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
              })()}
              <h4 className="text-sm font-bold text-slate-900 leading-tight">{activeDoc.title}</h4>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mb-4">{activeDoc.meta}</p>
            <div className="space-y-3">
              {shownBlocks.map((block, i) => {
                const lit = i === litBlockIndex
                const cited = !!block.criterionLabel
                return (
                  <p
                    key={i}
                    data-block={i}
                    className={[
                      'text-sm leading-relaxed rounded px-2.5 py-2 transition-all -mx-1',
                      lit
                        ? 'bg-emerald-100 ring-2 ring-emerald-500 text-slate-900'
                        : cited
                          ? 'bg-emerald-50 text-slate-700'
                          : 'text-slate-600',
                    ].join(' ')}
                  >
                    {isBuild ? renderRedacted(block.text) : block.text}
                  </p>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic text-center py-8">
            No source documents attached for this case.
          </p>
        )}

        {isBuild && (
          <RedactionLedger entries={ledger} open={ledgerOpen} onClose={() => setLedgerOpen(false)} />
        )}
      </div>
    </div>
  )
}
