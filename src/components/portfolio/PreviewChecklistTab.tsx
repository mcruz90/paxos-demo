import { CheckCircle2, Clock } from 'lucide-react'
import { type CriterionResult, type TimelineEvent } from '../../types'
import { CaseTimeline } from '../poc/CaseTimeline'
import { ActivityLog } from './ActivityLog'
import { type ActivityEntry, type LocalCaseState } from './caseQueue'
import { type CriterionActions, CriterionRow } from './CriterionRow'

export function PreviewChecklistTab({
  timeline,
  activity,
  sortedCriteria,
  progress,
  localState,
  actions,
  selectedCiteIndex,
  onSelectCiteIndex,
}: {
  timeline?: TimelineEvent[]
  activity: ActivityEntry[]
  sortedCriteria: { criterion: CriterionResult; origIdx: number }[]
  progress: { satisfied: number; total: number; awaitingDocs: number }
  localState: LocalCaseState
  actions: CriterionActions
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
}) {
  return (
    <>
      {timeline && (
        <div className="pb-3 border-b border-slate-800/60 select-none">
          <CaseTimeline events={timeline} compact />
        </div>
      )}
      <ActivityLog entries={activity} />
      <div id="tour-criteria-checklist">
        <div className="flex items-center justify-between mb-2 select-none">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Prior Auth Criteria Checklist</p>
          <span className="text-xs text-slate-500">
            {progress.satisfied} of {progress.total} addressed locally
            {progress.awaitingDocs > 0 && <span className="text-amber-400"> · {progress.awaitingDocs} awaiting docs</span>}
          </span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-3 select-none flex">
          <div className="h-full transition-all duration-500" style={{ width: `${(progress.satisfied / progress.total) * 100}%`, backgroundColor: progress.satisfied === progress.total ? '#10b981' : '#f59e0b' }} />
          <div className="h-full bg-amber-500/30 transition-all duration-500" style={{ width: `${(progress.awaitingDocs / progress.total) * 100}%` }} />
        </div>
        <div className="space-y-2">
          {sortedCriteria.map(({ criterion, origIdx }) => (
            <CriterionRow key={origIdx} index={origIdx + 1} criterion={criterion} localState={localState} actions={actions} isSelected={selectedCiteIndex === origIdx} onSelect={() => onSelectCiteIndex(origIdx)} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 select-none">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-800/40 text-slate-400 border-slate-700/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {progress.satisfied}/{progress.total} Criteria Addressed (Local)
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-800/40 text-slate-400 border-slate-700/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Gate Validation: Not Evaluated
          </span>
        </div>
      </div>
    </>
  )
}
