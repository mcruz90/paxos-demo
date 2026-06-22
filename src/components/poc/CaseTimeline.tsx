import { Fragment } from 'react'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import type { TimelineEvent } from '../../types'

export function CaseTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex items-start">
      {events.map((ev, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className={`flex-1 h-px mt-[14px] min-w-3 ${
              events[i - 1].status !== 'pending' ? 'bg-slate-600' : 'bg-slate-700'
            }`} />
          )}
          <div className="flex flex-col items-center gap-1 shrink-0 w-24">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
              ev.status === 'done'    ? 'bg-emerald-500/10 border-emerald-500/50' :
              ev.status === 'flagged' ? 'bg-amber-500/10 border-amber-500/50' :
                                       'bg-slate-800 border-slate-700'
            }`}>
              {ev.status === 'done'    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> :
               ev.status === 'flagged' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> :
                                        <Clock className="w-3.5 h-3.5 text-slate-500" />}
            </div>
            <p className={`text-xs font-semibold text-center leading-tight ${
              ev.status === 'done'    ? 'text-slate-300' :
              ev.status === 'flagged' ? 'text-amber-300' :
                                       'text-slate-500'
            }`}>{ev.label}</p>
            <p className="text-[10px] text-slate-500 text-center leading-tight">{ev.date}</p>
            {ev.note && (
              <p className="text-[10px] text-slate-500/70 text-center leading-tight">{ev.note}</p>
            )}
          </div>
        </Fragment>
      ))}
    </div>
  )
}
