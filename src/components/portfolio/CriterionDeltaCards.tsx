import { ArrowRight, CheckCircle2, FileSearch } from 'lucide-react'
import { type AttachedExcerpt, type FindingsDelta } from './caseQueue'

export function AttachedExcerptsBanner({
  attached,
  onReassess,
}: {
  attached: AttachedExcerpt[]
  onReassess?: () => void
}) {
  if (attached.length === 0) return null
  return (
    <div className="mt-2 p-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 space-y-1.5" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-blue-300">
          {attached.length} excerpt(s) attached — awaiting reassessment
        </span>
        {onReassess && (
          <button
            type="button"
            onClick={onReassess}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors"
          >
            <FileSearch className="w-3 h-3" /> Reassess Criterion
          </button>
        )}
      </div>
      <ul className="space-y-0.5 text-[11px] text-slate-300 list-disc list-inside">
        {attached.map(ex => <li key={ex.id} className="truncate">{ex.title}</li>)}
      </ul>
    </div>
  )
}

export function FindingsDeltaCard({ delta, overrideNote }: { delta?: FindingsDelta; overrideNote: string }) {
  if (!delta) {
    return (
      <div className="mt-2.5 p-2 bg-blue-950/20 border border-blue-500/10 rounded-lg space-y-1">
        <p className="text-[10px] font-mono text-slate-500 uppercase">COORDINATOR RATIONALE</p>
        <p className="text-xs text-blue-300 italic">&ldquo;{overrideNote}&rdquo;</p>
      </div>
    )
  }
  return (
    <div className="mt-2.5 p-2.5 rounded-lg border border-blue-500/25 bg-blue-500/5 space-y-1.5 text-xs">
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-blue-300 uppercase font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        Findings Delta
        <span className="ml-auto text-slate-500 font-normal">{delta.at} · {delta.attachedCount} excerpt(s)</span>
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
        <span className="shrink-0 font-semibold text-slate-500">Prior ({delta.priorStatus}):</span>
        <span className="leading-snug">{delta.priorNote}</span>
      </div>
      <div className="flex items-start gap-1.5 text-[11px] text-slate-200 pt-1 border-t border-slate-800/70">
        <ArrowRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
        <span className="leading-snug">{delta.rationale}</span>
      </div>
    </div>
  )
}
