import { Fragment } from 'react'
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import type { TimelineEvent } from '../../types'

export function CaseTimeline({ events, compact = false }: { events: TimelineEvent[]; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto text-xs py-0.5">
        {events.map((ev, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-slate-600 shrink-0">→</span>}
            <div className="inline-flex items-center gap-1.5 shrink-0">
              {ev.status === 'done'    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
               ev.status === 'flagged' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> :
                                         <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              <span className={`font-medium ${
                ev.status === 'done'    ? 'text-slate-300' :
                ev.status === 'flagged' ? 'text-amber-300 font-semibold' :
                                          'text-slate-500'
              }`}>{ev.label}</span>
              <span className="text-[11px] text-slate-500">({ev.date})</span>
            </div>
          </Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-start">
      {events.map((ev, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className={`flex-1 h-px mt-2.5 min-w-2 ${
              events[i - 1].status !== 'pending' ? 'bg-slate-600' : 'bg-slate-700'
            }`} />
          )}
          <div className="flex flex-col items-center gap-0.5 shrink-0 w-28">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
              ev.status === 'done'    ? 'bg-emerald-500/10 border-emerald-500/50' :
              ev.status === 'flagged' ? 'bg-amber-500/10 border-amber-500/50' :
                                       'bg-slate-800 border-slate-700'
            }`}>
              {ev.status === 'done'    ? <CheckCircle className="w-3 h-3 text-emerald-400" /> :
               ev.status === 'flagged' ? <AlertTriangle className="w-3 h-3 text-amber-400" /> :
                                        <Clock className="w-3 h-3 text-slate-500" />}
            </div>
            <p className={`text-[11px] font-semibold text-center leading-tight ${
              ev.status === 'done'    ? 'text-slate-300' :
              ev.status === 'flagged' ? 'text-amber-300' :
                                       'text-slate-500'
            }`}>{ev.label}</p>
            <p className="text-[10px] text-slate-500 text-center leading-tight">
              {ev.date}{ev.note && ` · ${ev.note}`}
            </p>
          </div>
        </Fragment>
      ))}
    </div>
  )
}
