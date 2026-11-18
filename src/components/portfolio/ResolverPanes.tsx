import { AlertTriangle, Check, CheckCircle2, FileText, Send, X } from 'lucide-react'
import { type WorkflowPlan } from '../../types'
import { type ResolverEvidenceOption } from './exceptionResolver'

export function ConflictComparisonCard({ conflictSources }: { conflictSources: { source: string; claim: string }[] }) {
  return (
    <div className="epic-card-rose rounded-xl border border-red-500/35 bg-red-500/5 p-3.5 space-y-2.5 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Side-by-Side Source Chart Contradiction
        </span>
        <span className="text-[11px] text-slate-400">Source facts preserved; requires clinician reconciliation</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {conflictSources.map((cs, idx) => (
          <div key={idx} className="epic-card rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1">
            <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{cs.source}</span>
            </p>
            <p className="text-xs text-slate-200 italic leading-relaxed">&ldquo;{cs.claim}&rdquo;</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SelectedEvidenceStrip({
  options,
  selected,
  onRemove,
}: {
  options: ResolverEvidenceOption[]
  selected: string[]
  onRemove: (id: string) => void
}) {
  if (selected.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 italic px-1">
        No evidence excerpts attached yet. Select from corpus on the left or record clinician rationale below.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {selected.map(id => {
        const opt = options.find(o => o.id === id)
        return (
          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="truncate max-w-[240px]">{opt?.title ?? id}</span>
            <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${opt?.title ?? id}`} className="hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}
    </div>
  )
}

export function WorkflowQueryCard({
  workflow,
  active,
  onSelect,
}: {
  workflow: WorkflowPlan
  active: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={[
        'cursor-pointer rounded-xl border p-4 transition-all space-y-2.5',
        active
          ? 'epic-card-amber bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
          : 'epic-card bg-slate-900/40 border-slate-800 hover:border-slate-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`}>
          {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Send Provider In-Basket / Outbound Query
        </span>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400 border-b border-slate-800 pb-1.5">
          <span>To: <strong className="text-slate-200">{workflow.recipient}</strong></span>
          <span>ETA: {workflow.turnaround}</span>
        </div>
        <p className="text-[11px] font-mono text-slate-500">Channel: {workflow.channel}</p>
        <p className="text-xs text-slate-200 leading-relaxed pt-0.5">
          &ldquo;Clinical PA clarification needed: {workflow.action}. Please reply via EHR In-Basket or attach updated attestation.&rdquo;
        </p>
      </div>
      <p className="text-[11px] text-slate-400">Parks case as <strong>Awaiting Documentation</strong> until response lands.</p>
    </div>
  )
}

export function JustificationOptions({
  options,
  selected,
  onToggle,
  custom,
  onCustomChange,
  dimmed,
  onActivateJustify,
}: {
  options: ResolverEvidenceOption[]
  selected: string[]
  onToggle: (id: string) => void
  custom: string
  onCustomChange: (val: string) => void
  dimmed: boolean
  onActivateJustify: () => void
}) {
  return (
    <div className={dimmed ? 'opacity-45 space-y-2.5' : 'space-y-2.5'} onClickCapture={() => { if (dimmed) onActivateJustify() }}>
      {options.map(opt => {
        const on = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`w-full text-left rounded-xl border p-3 transition-colors ${on ? 'epic-card bg-emerald-500/10 border-emerald-500/40' : 'epic-card bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}
          >
            <div className="flex items-start gap-2.5">
              <span className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors ${on ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                {on && <Check className="w-3 h-3 text-white" />}
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-200 leading-snug">{opt.title}</span>
                <span className="block text-xs text-slate-400 leading-relaxed mt-1 line-clamp-3">{opt.detail}</span>
              </span>
            </div>
          </button>
        )
      })}
      <div className="epic-card rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold text-slate-300 mb-1.5">Supporting Clinical Rationale</p>
        <textarea
          value={custom}
          onChange={e => onCustomChange(e.target.value)}
          rows={3}
          placeholder="Document chart reconciliation or clinical rationale…"
          className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
        />
      </div>
    </div>
  )
}

export function JustifyPathToggle({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-xl border px-4 py-3 transition-all ${active ? 'epic-card bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30' : 'epic-card bg-slate-900/40 border-slate-800 hover:border-slate-700'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
          {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Record Clinician Assessment &amp; Rationale (Local Override)
        </span>
      </div>
    </button>
  )
}
