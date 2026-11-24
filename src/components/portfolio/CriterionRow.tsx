import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Clock, FileSearch, HelpCircle, Zap } from 'lucide-react'
import { type CriterionResult, type ReviewCriterionResult } from '../../types'
import { ruleIcons } from '../ui'
import { type LocalCaseState } from './caseQueue'
import { type WiredCriterionMeta } from './caseAssessment'
import { AttachedExcerptsBanner, FindingsDeltaCard } from './CriterionDeltaCards'
import { classifyCriterionTaxonomy, derivePathwayBranch } from './previewHelpers'

export interface CriterionActions {
  stageDispatch: (ruleLabel: string) => void
  cancelDispatch: (ruleLabel: string) => void
  confirmDispatch: (ruleLabel: string) => void
  startOverride: (ruleLabel: string, baseText: string) => void
  cancelOverride: () => void
  applyOverride: (ruleLabel: string) => void
  setOverrideInput: (txt: string) => void
  // Opens the Exception Resolver modal (evidence presets + discovery console).
  openResolver?: (criterion: CriterionResult, initialPath?: 'workflow' | 'justify') => void
}

const TAXONOMY_CLS = {
  met: 'text-emerald-400 font-medium',
  reassessed_met: 'text-blue-400 font-medium',
  records_needed: 'bg-slate-800/70 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full',
  not_documented: 'bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full',
  exception_possible: 'bg-violet-500/15 text-violet-300 border border-violet-500/40 px-2 py-0.5 rounded-full',
  conflict: 'bg-red-500/15 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full',
} as const

function CriterionInlineState({ criterion, localState, actions, overrideNote, isPending, isOverriding }: {
  criterion: CriterionResult; localState: LocalCaseState; actions: CriterionActions; overrideNote?: string; isPending: boolean; isOverriding: boolean
}) {
  const attached = localState.attachedExcerpts?.[criterion.rule.label] ?? []
  const delta = localState.findingsDeltas?.[criterion.rule.label]

  if (overrideNote) return <FindingsDeltaCard delta={delta} overrideNote={overrideNote} />
  if (isPending && criterion.workflowPlan) {
    const wf = criterion.workflowPlan
    return (
      <div className="mt-2.5 p-3 bg-amber-950/20 border border-amber-500/25 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-amber-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Confirm outbound workflow:</p>
        <div className="space-y-1">
          {[{ k: 'Action', v: wf.action }, { k: 'Recipient', v: wf.recipient }, { k: 'Channel', v: wf.channel }, { k: 'Turnaround', v: wf.turnaround }].map(({ k, v }) => (
            <div key={k} className="flex text-[11px] font-mono"><span className="text-slate-500 w-20 shrink-0">{k}:</span><span className="text-slate-300">{v}</span></div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-1.5 border-t border-amber-500/10">
          <button type="button" onClick={() => actions.cancelDispatch(criterion.rule.label)} className="px-2 py-1 text-slate-400 hover:text-slate-300 text-xs rounded border border-slate-700">Cancel</button>
          <button type="button" onClick={() => actions.confirmDispatch(criterion.rule.label)} className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-medium">
            <Check className="w-3.5 h-3.5" /> Confirm Dispatch
          </button>
        </div>
      </div>
    )
  }
  if (isOverriding) {
    return (
      <div className="mt-2.5 p-3 bg-slate-900/80 border border-slate-700/60 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-slate-300">Amend finding / Enter clinical justification:</p>
        <textarea value={localState.overrideInput} onChange={e => actions.setOverrideInput(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500" rows={3} placeholder="Enter justification rationale..." autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={actions.cancelOverride} className="px-2 py-1 text-slate-400 hover:text-slate-300 text-xs rounded border border-slate-700">Cancel</button>
          <button type="button" onClick={() => actions.applyOverride(criterion.rule.label)} disabled={!localState.overrideInput.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-medium">Apply</button>
        </div>
      </div>
    )
  }
  return <AttachedExcerptsBanner attached={attached} onReassess={actions.openResolver ? () => actions.openResolver!(criterion, 'justify') : undefined} />
}

function CriterionResolveBar({ criterion, actions, isConflict }: { criterion: CriterionResult; actions: CriterionActions; isConflict: boolean }) {
  return (
    <div className={`mt-2 pt-2 border-t ${isConflict ? 'border-red-500/20' : 'border-amber-500/20'} flex items-center gap-2`} onClick={e => e.stopPropagation()}>
      {actions.openResolver ? (
        <button type="button" onClick={() => actions.openResolver!(criterion)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-100 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors shadow-xs">
          <FileSearch className={`w-3.5 h-3.5 ${isConflict ? 'text-red-400' : 'text-amber-400'}`} />
          Resolve Exception
          {criterion.workflowPlan && <span className="text-slate-400 font-normal">· {criterion.workflowPlan.channel}</span>}
        </button>
      ) : (
        <>
          <button type="button" onClick={() => actions.startOverride(criterion.rule.label, criterion.note)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 rounded px-2.5 py-1">Override Finding</button>
          {criterion.workflowPlan && (
            <button type="button" onClick={() => actions.stageDispatch(criterion.rule.label)} className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded px-2.5 py-1">
              <Zap className="w-3 h-3" /> Dispatch Workflow
            </button>
          )}
        </>
      )}
    </div>
  )
}

function WiredCriterionDetails({ meta }: { meta: WiredCriterionMeta }) {
  return (
    <div className="mt-1.5 space-y-1.5 text-xs">
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-1.5">
        <span className="font-semibold text-slate-300">Payer requirement:</span>{' '}
        <span className="text-slate-400">{meta.requirement}</span>
      </div>
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 px-2.5 py-1.5">
        <span className="font-semibold text-slate-300">Patient finding:</span>{' '}
        <span className={meta.isLocationOnly ? 'text-amber-300 italic' : 'text-slate-200'}>{meta.findingSummary}</span>
      </div>
      {meta.contextEvidence.length > 0 && (
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-2.5 py-1.5 text-[11px] text-sky-200">
          <span className="font-semibold text-sky-300">Context only (not proof):</span>{' '}
          {meta.contextEvidence.map(c => c.excerpt ?? `${c.source_version_id} [${c.start}..${c.end})`).join(' · ')}
        </div>
      )}
      {meta.nextAction && (
        <p className="text-[11px] text-amber-300">
          <span className="font-semibold">Next action:</span> {meta.nextAction}
        </p>
      )}
    </div>
  )
}

// Interactive checklist row: quiet neutral slate for met criteria, distinct rose for
// safety contradictions, Decision 0008 status taxonomy, and boolean AND/OR pathway tags.
export function CriterionRow({ index, criterion, localState, actions, isSelected, onSelect }: {
  index?: number; criterion: ReviewCriterionResult; localState: LocalCaseState; actions: CriterionActions; isSelected: boolean; onSelect: () => void
}) {
  const [expandedNote, setExpandedNote] = useState(false)
  const wired = criterion.assessment
  const isDispatched = localState.dispatched.includes(criterion.rule.label)
  const isPending = localState.pendingDispatch.includes(criterion.rule.label)
  const isOverriding = localState.pendingOverride === criterion.rule.label
  const overrideNote = localState.overrides[criterion.rule.label]
  const taxonomy = classifyCriterionTaxonomy(criterion, localState)
  const branch = derivePathwayBranch(criterion)
  const isConflict = wired ? wired.backendStatus === 'conflict' : taxonomy.code === 'conflict'
  const isOpenException = wired ? wired.backendStatus !== 'met' : !overrideNote && !isDispatched && criterion.status !== 'found'
  const canExpandNote = !wired && !isOpenException && criterion.note.length > 140
  const statusLabel = wired
    ? wired.backendStatus === 'met' ? '✓ Met' : wired.backendStatus === 'conflict' ? 'Conflict' : 'Missing'
    : taxonomy.code === 'met' ? '✓ Met' : taxonomy.label
  const statusCls = wired
    ? wired.backendStatus === 'met' ? TAXONOMY_CLS.met : wired.backendStatus === 'conflict' ? TAXONOMY_CLS.conflict : TAXONOMY_CLS.not_documented
    : TAXONOMY_CLS[taxonomy.code]
  const bgCls = isConflict
    ? 'epic-card-rose bg-red-500/10 border-red-500/40 hover:border-red-500/60'
    : isOpenException
      ? 'epic-card-amber bg-amber-500/10 border-amber-500/40 hover:border-amber-500/60'
      : 'epic-card bg-slate-900/30 border-slate-800 hover:border-slate-600'
  const ring = isSelected ? (isConflict ? 'ring-2 ring-red-500/50 border-red-500/50' : isOpenException ? 'ring-2 ring-amber-500/50 border-amber-500/50' : 'ring-2 ring-emerald-500/40 border-emerald-500/40') : ''

  return (
    <div onClick={onSelect} className={`rounded-xl border transition-all cursor-pointer shadow-xs ${isConflict || isOpenException ? 'p-3' : 'px-3 py-2.5'} ${bgCls} ${ring}`}>
      <div className="flex items-start gap-2.5">
        {isConflict ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" /> : isOpenException ? <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onSelect() }}
              aria-pressed={isSelected}
              className="text-left text-xs font-semibold text-slate-100 leading-snug hover:text-emerald-300 focus:outline-none focus-visible:underline"
            >
              {index !== undefined ? `${index}. ` : ''}{criterion.rule.label}
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              {wired && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-slate-300">
                  {wired.criterionId}
                </span>
              )}
              {wired?.isBlocker && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-red-500/40 bg-red-500/15 text-red-300">
                  Blocker
                </span>
              )}
              {!wired && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${branch.badgeCls}`}>{branch.operator}</span>}
              <span className={`text-[11px] whitespace-nowrap ${statusCls}`}>{statusLabel}</span>
            </div>
          </div>
          {wired ? (
            <WiredCriterionDetails meta={wired} />
          ) : (
            <>
              <p className={`text-xs text-slate-400 leading-snug ${canExpandNote && !expandedNote ? 'line-clamp-2' : ''}`}>{criterion.note}</p>
              {canExpandNote && (
                <button
                  type="button"
                  aria-expanded={expandedNote}
                  onClick={e => { e.stopPropagation(); setExpandedNote(v => !v) }}
                  className="text-[11px] text-blue-400 hover:underline mt-0.5"
                >
                  {expandedNote ? 'Show less' : 'Show full finding'}
                </button>
              )}
            </>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-slate-500 inline-flex items-center text-xs">{ruleIcons[criterion.rule.type]}</span>
            <span className="text-[11px] text-slate-500">Source: {criterion.docSource}</span>
          </div>
          <CriterionInlineState criterion={criterion} localState={localState} actions={actions} overrideNote={overrideNote} isPending={isPending} isOverriding={isOverriding} />
          {isOpenException && !isPending && !isOverriding && (
            <CriterionResolveBar criterion={criterion} actions={actions} isConflict={isConflict} />
          )}
        </div>
      </div>
    </div>
  )
}
