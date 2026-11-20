import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileCheck, GitCompare, PencilLine, ShieldCheck } from 'lucide-react'
import { type ScenarioConfig } from '../../types'
import { type RevisionInfo, type VerificationStates } from './letterNarrative'

export function CitationPill({ index, source, page, active, onSelect }: {
  index: number; source: string; page: string; active: boolean; onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={[
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-[11px] font-semibold border transition-all mx-0.5 align-baseline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
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
        <button
          type="button"
          aria-pressed={active}
          onClick={e => { e.stopPropagation(); onSelect(index) }}
          className="text-left text-xs font-bold text-slate-800 hover:text-emerald-700 focus:outline-none focus-visible:underline"
        >
          {heading}
        </button>
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

export function LetterVerificationBar({
  states, revisionInfo, showDiff, onToggleDiff, onRunLocalCheck, mode, onSetMode,
}: {
  states: VerificationStates; revisionInfo: RevisionInfo; showDiff: boolean
  onToggleDiff: () => void; onRunLocalCheck: () => void; mode: 'verify' | 'edit'; onSetMode: (m: 'verify' | 'edit') => void
}) {
  const pills = [
    { k: 'Citations', v: states.citationStatus },
    { k: 'Sources', v: states.sourceStatus },
    { k: 'Conflicts', v: states.contradictionStatus },
    { k: 'Policy match', v: states.policyMatchStatus },
    { k: 'Validation', v: states.validationStatus },
    { k: 'Approval', v: states.approvalStatus },
  ]
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 space-y-2 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mr-0.5" />
          <span className={`px-2 py-0.5 rounded-md font-semibold border ${revisionInfo.isEdited ? 'bg-amber-500/15 text-amber-300 border-amber-500/35' : 'bg-slate-900 text-slate-200 border-slate-700'}`}>
            {revisionInfo.revisionLabel} · {revisionInfo.localCheckLabel}
          </span>
          {pills.map(p => (
            <span key={p.k} className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 font-medium">
              <span className="text-slate-500">{p.k}:</span> {p.v}
            </span>
          ))}
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
      {revisionInfo.isEdited && (
        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-800/80 text-xs">
          <button type="button" onClick={onToggleDiff} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-medium transition-colors ${showDiff ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
            <GitCompare className="w-3.5 h-3.5" /> {showDiff ? 'Hide Diff vs. Rev 1' : 'Show Diff vs. Rev 1'}
          </button>
          <button type="button" onClick={onRunLocalCheck} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 hover:border-emerald-500/40 font-medium transition-colors">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Run Local Structure Check (Rev 2)
          </button>
        </div>
      )}
    </div>
  )
}

export function RevisionDiffCard({ baseline, edited, checkSummary }: {
  baseline: string; edited: string; checkSummary: { passed: boolean; detail: string } | null
}) {
  const [collapseBase, setCollapseBase] = useState(false)
  return (
    <div className="epic-card rounded-xl border border-blue-500/35 bg-blue-500/5 p-3.5 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-blue-300 flex items-center gap-1.5"><GitCompare className="w-3.5 h-3.5" /> Narrative Comparison (Rev 1 AI Draft → Rev 2 Local Edit)</span>
        <button type="button" onClick={() => setCollapseBase(v => !v)} className="text-[11px] text-slate-400 hover:text-slate-200 underline">
          {collapseBase ? 'Expand baseline' : 'Collapse baseline'}
        </button>
      </div>
      {checkSummary && (
        <p className={`text-[11px] font-medium px-2 py-1 rounded border ${checkSummary.passed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {checkSummary.detail}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {!collapseBase && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
            <p className="text-[10px] font-mono uppercase text-slate-500">Rev 1 · Baseline AI Draft</p>
            <p className="text-slate-400 leading-relaxed">{baseline}</p>
          </div>
        )}
        <div className="rounded-lg border border-blue-500/25 bg-slate-950/60 p-2.5 space-y-1">
          <p className="text-[10px] font-mono uppercase text-blue-300">Rev 2 · Clinician Edit</p>
          <p className="text-slate-200 leading-relaxed">{edited}</p>
        </div>
      </div>
    </div>
  )
}
