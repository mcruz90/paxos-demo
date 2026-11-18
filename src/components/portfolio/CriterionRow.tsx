import { AlertTriangle, Check, CheckCircle2, Clock, FileSearch, HelpCircle, Zap } from 'lucide-react'
import { type CriterionResult } from '../../types'
import { type LocalCaseState } from './caseQueue'
import { ruleIcons } from '../ui'

// Coordinator actions available on a criterion — staged/confirmed workflow
// dispatch and finding override. One handler object instead of seven props.
export interface CriterionActions {
  stageDispatch: (ruleLabel: string) => void
  cancelDispatch: (ruleLabel: string) => void
  confirmDispatch: (ruleLabel: string) => void
  startOverride: (ruleLabel: string, baseText: string) => void
  cancelOverride: () => void
  applyOverride: (ruleLabel: string) => void
  setOverrideInput: (txt: string) => void
  // Opens the Exception Resolver modal (evidence presets + discovery console)
  // for this criterion. Optional — views without the resolver omit it.
  openResolver?: (criterion: CriterionResult) => void
}

const STATUS_CFG = {
  found: {
    Icon: CheckCircle2,
    label: 'Satisfied',
    pillCls: 'text-emerald-400 font-medium',
    bgCls: 'epic-card bg-slate-900/30 border-slate-800 hover:border-slate-600',
  },
  needs_review: {
    Icon: HelpCircle,
    label: 'Needs Review',
    pillCls: 'bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full',
    bgCls: 'epic-card-amber bg-amber-500/10 border-amber-500/40 hover:border-amber-500/60',
  },
  conflict: {
    Icon: AlertTriangle,
    label: 'Safety Contradiction',
    pillCls: 'bg-red-500/15 text-red-300 border border-red-500/40 px-2 py-0.5 rounded-full',
    bgCls: 'epic-card-rose bg-red-500/10 border-red-500/40 hover:border-red-500/60',
  },
  dispatched: {
    Icon: Clock,
    label: 'Awaiting Docs',
    pillCls: 'bg-slate-800/70 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full',
    bgCls: 'epic-card bg-amber-500/5 border-amber-500/25 hover:border-amber-500/40',
  },
  override: {
    Icon: CheckCircle2,
    label: 'Resolved by Clinician',
    pillCls: 'text-blue-400 font-medium',
    bgCls: 'epic-card bg-blue-500/5 border-blue-500/25 hover:border-blue-500/40',
  },
} as const

// Interactive checklist row: quiet neutral slate for satisfied criteria,
// distinct rose for safety contradictions and warm amber for missing info.
export function CriterionRow({
  index,
  criterion,
  localState,
  actions,
  isSelected,
  onSelect,
}: {
  index?: number
  criterion: CriterionResult
  localState: LocalCaseState
  actions: CriterionActions
  isSelected: boolean
  onSelect: () => void
}) {
  const isDispatched = localState.dispatched.includes(criterion.rule.label)
  const isPending    = localState.pendingDispatch.includes(criterion.rule.label)
  const isOverriding = localState.pendingOverride === criterion.rule.label
  const overrideNote = localState.overrides[criterion.rule.label]

  const status = overrideNote ? 'override' : isDispatched ? 'dispatched' : criterion.status
  const cfg = STATUS_CFG[status]
  const isConflict = status === 'conflict'
  const isNeedsReview = status === 'needs_review'
  const isException = isConflict || isNeedsReview

  return (
    <div
      onClick={onSelect}
      className={[
        'rounded-xl border transition-all cursor-pointer shadow-xs',
        isException ? 'p-3' : 'px-3 py-2.5',
        cfg.bgCls,
        isSelected
          ? isConflict
            ? 'ring-2 ring-red-500/50 border-red-500/50'
            : isNeedsReview
              ? 'ring-2 ring-amber-500/50 border-amber-500/50'
              : 'ring-2 ring-emerald-500/40 border-emerald-500/40'
          : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        {isConflict ? (
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
        ) : isNeedsReview ? (
          <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-100 leading-snug">
              {index !== undefined ? `${index}. ` : ''}{criterion.rule.label}
            </span>
            <span className={`text-[11px] shrink-0 whitespace-nowrap ${cfg.pillCls}`}>
              {status === 'found' ? '✓ Satisfied' : cfg.label}
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-snug line-clamp-2">{criterion.note}</p>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-slate-500 inline-flex items-center text-xs">
              {ruleIcons[criterion.rule.type]}
            </span>
            <span className="text-[11px] text-slate-500">Source: {criterion.docSource}</span>
          </div>

          {overrideNote ? (
            <div className="mt-2.5 p-2 bg-blue-950/20 border border-blue-500/10 rounded-lg space-y-1">
              <p className="text-[10px] font-mono text-slate-500 uppercase">COORDINATOR RATIONALE</p>
              <p className="text-xs text-blue-300 italic">"{overrideNote}"</p>
            </div>
          ) : isPending && criterion.workflowPlan ? (
            <div className="mt-2.5 p-3 bg-amber-950/20 border border-amber-500/25 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Confirm outbound workflow:
              </p>
              <div className="space-y-1">
                {[
                  { k: 'Action', v: criterion.workflowPlan.action },
                  { k: 'Recipient', v: criterion.workflowPlan.recipient },
                  { k: 'Channel', v: criterion.workflowPlan.channel },
                  { k: 'Turnaround', v: criterion.workflowPlan.turnaround },
                ].map(({ k, v }) => (
                  <div key={k} className="flex text-[11px] font-mono">
                    <span className="text-slate-500 w-20 shrink-0">{k}:</span>
                    <span className="text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1.5 border-t border-amber-500/10">
                <button
                  onClick={() => actions.cancelDispatch(criterion.rule.label)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => actions.confirmDispatch(criterion.rule.label)}
                  className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" /> Confirm Dispatch
                </button>
              </div>
            </div>
          ) : isOverriding ? (
            <div className="mt-2.5 p-3 bg-slate-900/80 border border-slate-700/60 rounded-lg space-y-2" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-semibold text-slate-300">Amend finding / Enter clinical justification:</p>
              <textarea
                value={localState.overrideInput}
                onChange={e => actions.setOverrideInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                rows={3}
                placeholder="Enter justification rationale..."
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={actions.cancelOverride}
                  className="px-2 py-1 text-slate-400 hover:text-slate-300 text-xs rounded border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => actions.applyOverride(criterion.rule.label)}
                  disabled={!localState.overrideInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}

          {criterion.status !== 'found' && !isDispatched && !isPending && !isOverriding && !overrideNote && (
            <div className={`mt-2 pt-2 border-t ${isConflict ? 'border-red-500/20' : 'border-amber-500/20'} flex items-center gap-2`} onClick={e => e.stopPropagation()}>
              {actions.openResolver ? (
                <button
                  onClick={() => actions.openResolver!(criterion)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-100 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-1.5 transition-colors shadow-xs"
                >
                  <FileSearch className={`w-3.5 h-3.5 ${isConflict ? 'text-red-400' : 'text-amber-400'}`} />
                  Resolve Exception
                  {criterion.workflowPlan && (
                    <span className="text-slate-400 font-normal">· {criterion.workflowPlan.channel}</span>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => actions.startOverride(criterion.rule.label, criterion.note)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 rounded px-2.5 py-1 transition-colors"
                  >
                    Override Finding
                  </button>
                  {criterion.workflowPlan && (
                    <button
                      onClick={() => actions.stageDispatch(criterion.rule.label)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded px-2.5 py-1 transition-colors"
                    >
                      <Zap className="w-3 h-3" /> Dispatch Workflow
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
