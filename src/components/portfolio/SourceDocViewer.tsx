import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, FileText, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig, type SourceDocBlock, type SourceDocument } from '../../types'
import { presentationForSource } from './documentKindPresentation'
import { type PhiDictionary, type RedactionEntry, redactBlocks } from './redaction'
import { defaultDocId, ensureSourceDocuments, findCitedBlock } from './sourceDocuments'

const REDACTION_SPLIT = /(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})/g
const REDACTION_TOKEN = /^(\[REDACTED — [^\]]+\]|XX\/XX\/\d{4})$/

function renderRedacted(text: string, darkNative = false) {
  return text.split(REDACTION_SPLIT).map((part, i) =>
    REDACTION_TOKEN.test(part) ? (
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
    ) : (
      part
    ),
  )
}

function SourceDocHeader({
  docs,
  shownDocId,
  onSelectDoc,
  isBuild,
  maskedCount,
  ledgerOpen,
  onToggleLedger,
  canTogglePlane,
  effectivePlane,
  onSelectPlane,
}: {
  docs: SourceDocument[]
  shownDocId: string | null
  onSelectDoc: (id: string) => void
  isBuild: boolean
  maskedCount: number
  ledgerOpen: boolean
  onToggleLedger: () => void
  canTogglePlane: boolean
  effectivePlane: 'operate' | 'build'
  onSelectPlane: (p: 'operate' | 'build') => void
}) {
  return (
    <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="text-sm font-semibold text-slate-100 whitespace-nowrap">
            {isBuild ? 'PII-Redacted Tokenizer' : 'Source Chart'}
          </h3>
        </div>
        {isBuild ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-violet-200 bg-violet-500/10 border border-violet-500/25 rounded-md px-2 py-0.5 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <strong className="font-mono">{maskedCount}</strong> token{maskedCount !== 1 ? 's' : ''} masked
          </span>
        ) : canTogglePlane ? (
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
            {(['operate', 'build'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onSelectPlane(p)}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  effectivePlane === p
                    ? p === 'build' ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {p === 'operate' ? 'Operate' : 'Build'}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {docs.length > 0 && (
          <select
            aria-label="Switch source document"
            value={shownDocId ?? ''}
            onChange={e => onSelectDoc(e.target.value)}
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
          >
            {docs.map((doc, idx) => (
              <option key={doc.id} value={doc.id}>Doc {idx + 1}/{docs.length}: {doc.title}</option>
            ))}
          </select>
        )}
        {isBuild && (
          <button
            type="button"
            onClick={onToggleLedger}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
              ledgerOpen ? 'bg-violet-500/20 text-violet-200 border-violet-500/40' : 'bg-slate-900 text-violet-200 border-slate-700 hover:border-violet-500/40'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> {ledgerOpen ? 'Hide' : 'Show'} Ledger
          </button>
        )}
      </div>
    </div>
  )
}

function InlineRedactionLedger({ maskedCount, ledger }: { maskedCount: number; ledger: RedactionEntry[] }) {
  return (
    <div className="px-4 py-3 bg-violet-950/30 border-b border-violet-500/25 space-y-2 shrink-0">
      <p className="text-[11px] text-violet-200 leading-relaxed">
        <strong>{maskedCount}</strong> direct identifier{maskedCount !== 1 ? 's' : ''} masked by local PII tokenization preview — not legal de-identification certification.
      </p>
      {ledger.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {ledger.map(e => (
            <div key={e.category} className="rounded-lg border border-violet-500/20 bg-slate-900/70 px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-200">{e.category}</span>
                <span className="font-mono text-violet-300">×{e.count}</span>
              </div>
              <p className="font-mono text-[10px] text-rose-300 mt-0.5">{e.token}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">No direct PHI identifiers detected in this document.</p>
      )}
    </div>
  )
}

function DocumentBody({
  activeDoc,
  shownBlocks,
  litBlockIndex,
  isBuild,
  blockClass,
}: {
  activeDoc: SourceDocument | null
  shownBlocks: SourceDocBlock[]
  litBlockIndex: number | null
  isBuild: boolean
  blockClass: (lit: boolean, cited: boolean) => string
}) {
  if (!activeDoc) {
    return <p className="text-sm text-slate-500 italic text-center py-8">No source documents attached for this case.</p>
  }
  const { Icon, tone } = presentationForSource(activeDoc.source)
  if (isBuild) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-slate-200 font-mono text-xs leading-relaxed">
        <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-slate-800">
          <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
          <h4 className="text-xs font-bold text-slate-100 leading-tight">{activeDoc.title}</h4>
          <span className="ml-auto text-[10px] text-slate-500 truncate">{activeDoc.meta}</span>
        </div>
        <div className="space-y-2.5">
          {shownBlocks.map((block, i) => (
            <p key={i} data-block={i} className={`leading-relaxed rounded-lg px-2.5 py-2 transition-all ${blockClass(i === litBlockIndex, !!block.criterionLabel)}`}>
              {renderRedacted(block.text, true)}
            </p>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="paper bg-white rounded-lg shadow-inner border border-slate-200 p-5 max-w-[600px] mx-auto text-slate-800">
      <div className="flex items-center gap-2 pb-2 mb-2.5 border-b border-slate-200">
        <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
        <h4 className="text-sm font-bold text-slate-900 leading-tight">{activeDoc.title}</h4>
      </div>
      <p className="text-[11px] font-mono text-slate-400 mb-3">{activeDoc.meta}</p>
      <div className="space-y-2.5">
        {shownBlocks.map((block, i) => (
          <p key={i} data-block={i} className={`text-sm leading-relaxed rounded px-2.5 py-2 transition-all -mx-1 ${blockClass(i === litBlockIndex, !!block.criterionLabel)}`}>
            {block.text}
          </p>
        ))}
      </div>
    </div>
  )
}

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
  useEffect(() => { setPlane(forcePlane ?? 'operate'); setLedgerOpen(false) }, [scenario.id, forcePlane])

  const effectivePlane = forcePlane ?? plane
  const activeCriterion = activeCiteIndex !== null ? scenario.criteriaResults[activeCiteIndex] ?? null : null
  const activeCited = useMemo(() => (activeCriterion ? findCitedBlock(docs, activeCriterion.rule.label) : null), [docs, activeCriterion])

  useEffect(() => { if (activeCited) onSelectDoc(activeCited.docId) }, [activeCited]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeDoc = docs.find(d => d.id === (activeDocId ?? defaultDocId(docs))) ?? docs[0] ?? null
  const litBlockIndex = activeCited && activeDoc && activeCited.docId === activeDoc.id ? activeCited.blockIndex : null
  const isBuild = effectivePlane === 'build' && !!phi
  const { blocks: shownBlocks, ledger } = useMemo(() => (
    !activeDoc ? { blocks: [], ledger: [] } : isBuild && phi ? redactBlocks(activeDoc.blocks, phi) : { blocks: activeDoc.blocks, ledger: [] }
  ), [activeDoc, isBuild, phi])
  const maskedCount = ledger.reduce((sum, entry) => sum + entry.count, 0)

  useEffect(() => {
    if (litBlockIndex === null) return
    bodyRef.current?.querySelector(`[data-block="${litBlockIndex}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [litBlockIndex, activeDoc?.id])

  const blockClass = (lit: boolean, cited: boolean) => {
    const toneMap = { conflict: isBuild ? 'bg-red-500/15 ring-1 ring-red-400 text-slate-100' : 'bg-red-50 ring-2 ring-red-500 text-slate-900', needs_review: isBuild ? 'bg-amber-500/15 ring-1 ring-amber-400 text-slate-100' : 'bg-amber-50 ring-2 ring-amber-500 text-slate-900' }
    if (lit) return activeCriterion?.status === 'conflict' ? toneMap.conflict : activeCriterion?.status === 'needs_review' ? toneMap.needs_review : isBuild ? 'bg-emerald-500/15 ring-1 ring-emerald-500/50 text-slate-100' : 'bg-emerald-100 ring-2 ring-emerald-500 text-slate-900'
    return isBuild ? (cited ? 'bg-slate-800/70 text-slate-200 border border-slate-700/60' : 'text-slate-400') : (cited ? 'bg-emerald-50/70 text-slate-700' : 'text-slate-600')
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isBuild ? 'bg-slate-950' : 'bg-slate-900/20'}`}>
      {!compactHeader && (
        <SourceDocHeader
          docs={docs} shownDocId={activeDoc?.id ?? null} onSelectDoc={onSelectDoc} isBuild={isBuild}
          maskedCount={maskedCount} ledgerOpen={ledgerOpen} onToggleLedger={() => setLedgerOpen(o => !o)}
          canTogglePlane={!!phi && !forcePlane} effectivePlane={effectivePlane} onSelectPlane={setPlane}
        />
      )}
      {isBuild && ledgerOpen && <InlineRedactionLedger maskedCount={maskedCount} ledger={ledger} />}
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 relative">
        <DocumentBody activeDoc={activeDoc} shownBlocks={shownBlocks} litBlockIndex={litBlockIndex} isBuild={isBuild} blockClass={blockClass} />
      </div>
    </div>
  )
}
