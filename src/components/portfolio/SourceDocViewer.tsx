import { useEffect, useMemo, useRef, useState } from 'react'
import { resolvePatientContext } from '../../data/patientContext'
import { initialClients } from '../../data/scenarios'
import { type ScenarioConfig } from '../../types'
import { type PhiDictionary, buildEvalPlaneTokenization, redactBlocks } from './redaction'
import { DocumentBody, InlineRedactionLedger, SourceDocHeader } from './SourceDocViewerParts'
import { defaultDocId, ensureSourceDocuments, findCitedBlock } from './sourceDocuments'

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

  const matchedClient = useMemo(() => initialClients.find(c => c.scenarioId === scenario.id) ?? initialClients[0], [scenario.id])
  const evalMeta = useMemo(() => {
    if (!isBuild || !activeDoc) return null
    return buildEvalPlaneTokenization(activeDoc.blocks, resolvePatientContext(scenario, matchedClient), -42)
  }, [isBuild, activeDoc, scenario, matchedClient])

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
      {isBuild && evalMeta && (
        <div className="px-4 py-1.5 border-b border-slate-800 bg-slate-900/30 flex flex-wrap items-center gap-1.5 font-mono text-[10px] shrink-0">
          <span className="px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-300">{evalMeta.specialtyToken}</span>
          <span className="px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-300">Date Shift: {evalMeta.dateOffsetDays}d (intervals preserved)</span>
          <span className={`px-1.5 py-0.5 rounded border ${evalMeta.residualHeld ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
            residual.held: {evalMeta.residualHeld ? 'TRUE' : 'FALSE'}
          </span>
        </div>
      )}
      {isBuild && ledgerOpen && <InlineRedactionLedger maskedCount={maskedCount} ledger={ledger} />}
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 relative">
        <DocumentBody activeDoc={activeDoc} shownBlocks={shownBlocks} litBlockIndex={litBlockIndex} isBuild={isBuild} blockClass={blockClass} />
      </div>
    </div>
  )
}
