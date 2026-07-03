import { AlertTriangle, Check, CheckCircle2, Clock, HelpCircle, Zap } from 'lucide-react'
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
}

const STATUS_CFG = {
  found: {
    Icon: CheckCircle2,
    label: 'Satisfied',
    iconCls: 'text-emerald-400',
    textCls: 'text-emerald-400',
    bgCls: 'bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/20',
  },
  needs_review: {
    Icon: HelpCircle,
    label: 'Unresolved',
    iconCls: 'text-amber-400',
    textCls: 'text-amber-400',
    bgCls: 'bg-amber-500/5 border-amber-500/15 hover:border-amber-500/20',
  },
  conflict: {
    Icon: AlertTriangle,
    label: 'Conflict',
    iconCls: 'text-red-400',
    textCls: 'text-red-400',
    bgCls: 'bg-red-500/5 border-red-500/20 hover:border-red-500/30',
  },
  dispatched: {
    Icon: CheckCircle2,
    label: 'Dispatched',
    iconCls: 'text-emerald-400',
    textCls: 'text-emerald-400',
    bgCls: 'bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/30',
  },
  override: {
    Icon: CheckCircle2,
    label: 'Overridden',
    iconCls: 'text-blue-400',
    textCls: 'text-blue-400',
    bgCls: 'bg-blue-500/5 border-blue-500/15 hover:border-blue-500/25',
  },
} as const

// Interactive checklist row: shows the AI finding and lets the coordinator
// dispatch the criterion's outbound workflow or override the finding.
export function CriterionRow({
  criterion,
  localState,
  actions,
  isSelected,
  onSelect,
}: {
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

  return (
    <div
      onClick={onSelect}
      className={[
        'rounded-lg border p-3 transition-all cursor-pointer',
        cfg.bgCls,
        isSelected ? 'ring-2 ring-emerald-500/40 border-emerald-500/40' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        <cfg.Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconCls}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="text-xs font-semibold text-slate-200 leading-snug">
              {criterion.rule.label}
            </span>
            <span className={`text-xs font-semibold shrink-0 ${cfg.textCls}`}>{cfg.label}</span>
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-slate-600 inline-flex items-center text-xs">
              {ruleIcons[criterion.rule.type]}
            </span>
            <span className="text-xs text-slate-500">{criterion.docSource}</span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{criterion.note}</p>

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
            <div className="mt-3 pt-2.5 border-t border-slate-700/30 flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
