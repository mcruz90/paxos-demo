import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, FileText, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { presentationForSource } from './documentKindPresentation'
import { type PhiDictionary, redactBlocks } from './redaction'
import { RedactionLedger } from './RedactionLedger'
import { defaultDocId, ensureSourceDocuments, findCitedBlock } from './sourceDocuments'

// Highlights redaction tokens ([REDACTED — …] / XX/XX/YYYY) in dark-native rose
// pills (Build plane) or light red pills (fallback).
const REDACTION_SPLIT = /(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})/g
const REDACTION_TOKEN = /^(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})$/
function renderRedacted(text: string, darkNative = false) {
  return text.split(REDACTION_SPLIT).map((part, i) =>
    REDACTION_TOKEN.test(part)
      ? (
        <span
          key={i}
          className={
            darkNative
              ? 'font-mono text-[0.9em] text-rose-300 bg-rose-500/20 border border-rose-500/30 rounded px-1.5 py-0.5'
              : 'font-mono text-[0.85em] text-red-600 bg-red-100 rounded px-1 py-0.5'
          }
        >
          {part}
        </span>
      )
      : part,
  )
}

// Source document viewer:
// - In Operate (`forcePlane="operate"` + `compactHeader`): renders inside EvidencePane's
//   single unified header bar on clean clinical paper, coloring active spans by
//   criterion status (rose for conflict, amber for needs_review, emerald for satisfied).
// - In Build (`forcePlane="build"`): renders as a dark-native monospace PHI-redacted
//   tokenizer plane matching Concept B's dark engineering aesthetic.
export function SourceDocViewer({
  scenario,
  activeCiteIndex,
  activeDocId,
  onSelectDoc,
  phi,
  forcePlane,
  compactHeader = false,
}: {
  scenario: ScenarioConfig
  activeCiteIndex: number | null
  activeDocId: string | null
  onSelectDoc: (docId: string) => void
  phi?: PhiDictionary | null
  forcePlane?: 'operate' | 'build'
  compactHeader?: boolean
}) {
  const docs = useMemo(() => ensureSourceDocuments(scenario), [scenario])
  const bodyRef = useRef<HTMLDivElement>(null)
  const [plane, setPlane] = useState<'operate' | 'build'>(forcePlane ?? 'operate')
  const [ledgerOpen, setLedgerOpen] = useState(false)
  useEffect(() => {
    setPlane(forcePlane ?? 'operate')
    setLedgerOpen(false)
  }, [scenario.id, forcePlane])

  const effectivePlane = forcePlane ?? plane

  const activeCriterion =
    activeCiteIndex !== null ? scenario.criteriaResults[activeCiteIndex] ?? null : null
  const activeLabel = activeCriterion?.rule.label ?? null
  const activeCited = useMemo(
    () => (activeLabel ? findCitedBlock(docs, activeLabel) : null),
    [docs, activeLabel],
  )

  useEffect(() => {
    if (activeCited) onSelectDoc(activeCited.docId)
  }, [activeCited]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownDocId = activeDocId ?? defaultDocId(docs)
  const activeDoc = docs.find(d => d.id === shownDocId) ?? docs[0] ?? null
  const litBlockIndex =
    activeCited && activeDoc && activeCited.docId === activeDoc.id ? activeCited.blockIndex : null

  const isBuild = effectivePlane === 'build' && !!phi
  const { blocks: shownBlocks, ledger } = useMemo(() => {
    if (!activeDoc) return { blocks: [], ledger: [] }
    if (!isBuild || !phi) return { blocks: activeDoc.blocks, ledger: [] }
    return redactBlocks(activeDoc.blocks, phi)
  }, [activeDoc, isBuild, phi])
  const maskedCount = ledger.reduce((sum, entry) => sum + entry.count, 0)

  useEffect(() => {
    if (litBlockIndex === null) return
    const el = bodyRef.current?.querySelector(`[data-block="${litBlockIndex}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [litBlockIndex, activeDoc?.id])

  const blockClass = (lit: boolean, cited: boolean) => {
    if (isBuild) {
      if (lit) {
        if (activeCriterion?.status === 'conflict') return 'bg-red-500/15 ring-1 ring-red-400 text-slate-100'
        if (activeCriterion?.status === 'needs_review') return 'bg-amber-500/15 ring-1 ring-amber-400 text-slate-100'
        return 'bg-emerald-500/15 ring-1 ring-emerald-500/50 text-slate-100'
      }
      return cited ? 'bg-slate-800/70 text-slate-200 border border-slate-700/60' : 'text-slate-400'
    }
    if (lit) {
      if (activeCriterion?.status === 'conflict') return 'bg-red-50 ring-2 ring-red-500 text-slate-900'
      if (activeCriterion?.status === 'needs_review') return 'bg-amber-50 ring-2 ring-amber-500 text-slate-900'
      return 'bg-emerald-100 ring-2 ring-emerald-500 text-slate-900'
    }
    return cited ? 'bg-emerald-50/70 text-slate-700' : 'text-slate-600'
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isBuild ? 'bg-slate-950' : 'bg-slate-900/20'}`}>
      {!compactHeader && (
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold text-slate-200 whitespace-nowrap">
                {isBuild ? 'PII-Redacted Tokenizer' : 'Source Chart'}
              </h3>
            </div>
            {docs.length > 0 && (
              <select
                aria-label="Switch source document"
                value={activeDoc?.id ?? ''}
                onChange={e => onSelectDoc(e.target.value)}
                className="max-w-[190px] bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                {docs.map((doc, idx) => (
                  <option key={doc.id} value={doc.id}>
                    Doc {idx + 1}/{docs.length}: {doc.title}
                  </option>
                ))}
              </select>
            )}
            {phi && !forcePlane && (
              <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                {([
                  { p: 'operate' as const, label: 'Operate' },
                  { p: 'build' as const,   label: 'Build' },
                ]).map(({ p, label }) => (
                  <button
                    key={p}
                    onClick={() => setPlane(p)}
                    className={[
                      'px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors',
                      effectivePlane === p
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
        </div>
      )}

      {isBuild && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-violet-500/10 border-b border-violet-500/25 shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-violet-200 leading-tight whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span><strong className="font-mono">{maskedCount}</strong> PHI token{maskedCount !== 1 ? 's' : ''} masked</span>
          </span>
          <button
            onClick={() => setLedgerOpen(o => !o)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-violet-200 border border-violet-500/30 hover:bg-violet-500/15 transition-colors whitespace-nowrap"
          >
            <Eye className="w-3 h-3" /> {ledgerOpen ? 'Hide' : 'Show'} Ledger
          </button>
        </div>
      )}

      <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 relative">
        {activeDoc ? (
          isBuild ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-200 font-mono text-xs leading-relaxed">
              <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-800">
                {(() => {
                  const { Icon, tone } = presentationForSource(activeDoc.source)
                  return <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
                })()}
                <h4 className="text-xs font-bold text-slate-100 leading-tight">{activeDoc.title}</h4>
                <span className="ml-auto text-[10px] text-slate-500 truncate">{activeDoc.meta}</span>
              </div>
              <div className="space-y-2.5">
                {shownBlocks.map((block, i) => {
                  const lit = i === litBlockIndex
                  const cited = !!block.criterionLabel
                  return (
                    <p
                      key={i}
                      data-block={i}
                      className={`leading-relaxed rounded-lg px-2.5 py-2 transition-all ${blockClass(lit, cited)}`}
                    >
                      {renderRedacted(block.text, true)}
                    </p>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="paper bg-white rounded-lg shadow-inner border border-slate-200 p-5 max-w-[600px] mx-auto text-slate-800">
              <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-slate-200">
                {(() => {
                  const { Icon, tone } = presentationForSource(activeDoc.source)
                  return <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
                })()}
                <h4 className="text-sm font-bold text-slate-900 leading-tight">{activeDoc.title}</h4>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mb-3">{activeDoc.meta}</p>
              <div className="space-y-2.5">
                {shownBlocks.map((block, i) => {
                  const lit = i === litBlockIndex
                  const cited = !!block.criterionLabel
                  return (
                    <p
                      key={i}
                      data-block={i}
                      className={`text-sm leading-relaxed rounded px-2.5 py-2 transition-all -mx-1 ${blockClass(lit, cited)}`}
                    >
                      {block.text}
                    </p>
                  )
                })}
              </div>
            </div>
          )
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
