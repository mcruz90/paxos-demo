import { AlertTriangle, CheckCircle2, FileCheck, PencilLine } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { type VerificationStates } from './letterNarrative'

export function CitationPill({ index, source, page, active, onSelect }: {
  index: number; source: string; page: string; active: boolean; onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-[11px] font-semibold border transition-all mx-0.5 align-baseline',
        active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100',
      ].join(' ')}
      title={`Jump to ${source} (${page}) in Source Chart`}
    >
      [Cite {index + 1}: {source} · {page}]
    </button>
  )
}

export function CitedCriterionRow({ index, scenario, heading, showAnswer, active, onSelect }: {
  index: number; scenario: ScenarioConfig; heading: string; showAnswer: boolean; active: boolean; onSelect: (idx: number) => void
}) {
  const cr = scenario.criteriaResults[index]
  const cite = scenario.citations[cr.rule.label]
  return (
    <div
      onClick={() => onSelect(index)}
      className={`pl-3 border-l-4 rounded-sm pr-2 py-2 transition-colors cursor-pointer ${active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold text-slate-800">{heading}</p>
        {cite && <CitationPill index={index} source={cite.source} page={cite.page} active={active} onSelect={() => onSelect(index)} />}
      </div>
      {showAnswer && <p className="text-xs text-emerald-600 font-semibold mt-0.5">Answer: Met</p>}
      <p className="text-xs italic text-slate-600 mt-1">&ldquo;{cite ? cite.text : 'Supporting documentation confirmed.'}&rdquo;</p>
    </div>
  )
}

export function BlockedDraftBanner({ onGoToChecklist }: { onGoToChecklist: () => void }) {
  return (
    <div className="epic-card-amber rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none">
      <div className="flex items-start gap-2.5 text-xs text-slate-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-amber-300">Approval &amp; export disabled — unresolved clinical exceptions remain in checklist</p>
          <p className="text-slate-300 mt-0.5">Reviewing held draft below; resolve open checklist items before signing or filing.</p>
        </div>
      </div>
      <button type="button" onClick={onGoToChecklist} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors shrink-0">
        Go to Criteria Checklist
      </button>
    </div>
  )
}

export function LetterVerificationBar({ states, isEdited, mode, onSetMode }: {
  states: VerificationStates; isEdited: boolean; mode: 'verify' | 'edit'; onSetMode: (m: 'verify' | 'edit') => void
}) {
  const pills = [
    { k: 'Citations', v: states.citationStatus },
    { k: 'Sources', v: states.sourceStatus },
    { k: 'Conflicts', v: states.contradictionStatus },
    { k: 'Gate', v: states.gateStatus },
    { k: 'Approval', v: states.approvalStatus },
  ]
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 select-none">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mr-0.5" />
        {pills.map(p => (
          <span key={p.k} className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 font-medium">
            <span className="text-slate-500">{p.k}:</span> {p.v}
          </span>
        ))}
        {isEdited && (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
            Unsaved local draft — not validated
          </span>
        )}
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-900/60 border border-slate-700/70 p-0.5">
        <button type="button" onClick={() => onSetMode('verify')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${mode === 'verify' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <FileCheck className="w-3.5 h-3.5" /> Verify Citations Mode
        </button>
        <button type="button" onClick={() => onSetMode('edit')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${mode === 'edit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
          <PencilLine className="w-3.5 h-3.5" /> Edit Text Inline
        </button>
      </div>
    </div>
  )
}
