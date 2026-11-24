import { CheckCircle2, Clock } from 'lucide-react'
import { type CaseAssessment } from '../../lib/wire'
import { type CriterionResult, type TimelineEvent } from '../../types'
import { CaseTimeline } from '../poc/CaseTimeline'
import { ActivityLog } from './ActivityLog'
import { buildAssessmentView } from './caseAssessment'
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
  assessment,
}: {
  timeline?: TimelineEvent[]
  activity: ActivityEntry[]
  sortedCriteria: { criterion: CriterionResult; origIdx: number }[]
  progress: { satisfied: number; total: number; awaitingDocs: number }
  localState: LocalCaseState
  actions: CriterionActions
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  assessment?: CaseAssessment | null
}) {
  const wired = assessment ? buildAssessmentView(assessment) : null
  const rows = wired ? wired.criteria.map((criterion, origIdx) => ({ criterion, origIdx })) : sortedCriteria
  const satisfied = wired ? wired.metCount : progress.satisfied
  const total = wired ? wired.totalCount : progress.total
  const awaitingDocs = wired ? 0 : progress.awaitingDocs
  const pct = total > 0 ? (satisfied / total) * 100 : 0

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
            {wired
              ? `${satisfied} of ${total} met (backend assessment rev ${wired.revision})`
              : `${satisfied} of ${total} addressed locally`}
            {awaitingDocs > 0 && <span className="text-amber-400"> · {awaitingDocs} awaiting docs</span>}
          </span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-3 select-none flex">
          <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: satisfied === total && total > 0 ? '#10b981' : '#f59e0b' }} />
          <div className="h-full bg-amber-500/30 transition-all duration-500" style={{ width: `${total > 0 ? (awaitingDocs / total) * 100 : 0}%` }} />
        </div>
        {wired && wired.nextAction && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span className="font-semibold text-amber-300">Next action:</span> {wired.nextAction}
          </div>
        )}
        <div className="space-y-2">
          {rows.map(({ criterion, origIdx }) => (
            <CriterionRow key={criterion.assessment?.criterionId ?? origIdx} index={origIdx + 1} criterion={criterion} localState={localState} actions={actions} isSelected={selectedCiteIndex === origIdx} onSelect={() => onSelectCiteIndex(origIdx)} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 select-none">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-800/40 text-slate-400 border-slate-700/60">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {wired ? `${satisfied}/${total} Criteria Met · ${wired.readyLabel}` : `${satisfied}/${total} Criteria Addressed (Local)`}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-slate-800/40 text-slate-400 border-slate-700/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            {wired
              ? `Blockers: ${wired.blockers.length > 0 ? wired.blockers.join(', ') : 'None'}`
              : 'Gate Validation: Not Evaluated'}
          </span>
        </div>
      </div>
    </>
  )
}
