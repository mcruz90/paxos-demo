import { useState } from 'react'
import { AlertTriangle, Mail, X } from 'lucide-react'
import { type ResolverContext, assembleJustification } from './exceptionResolver'
import { EvidenceDiscoveryConsole } from './EvidenceDiscoveryConsole'
import { ConflictComparisonCard, JustificationOptions, JustifyPathToggle, SelectedEvidenceStrip, WorkflowQueryCard } from './ResolverPanes'

export type ResolutionPath = 'workflow' | 'justify'

function ResolverHeader({ ctx, onClose }: { ctx: ResolverContext; onClose: () => void }) {
  const [showPolicy, setShowPolicy] = useState(false)
  const isLong = ctx.policyNote.length > 140

  return (
    <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {ctx.conflictSources?.length ? <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /> : <Mail className="w-4 h-4 text-amber-400 shrink-0" />}
          <h2 className="text-base font-bold text-white truncate">{ctx.title}</h2>
        </div>
        <p className={`text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl ${isLong && !showPolicy ? 'line-clamp-2' : ''}`}>
          {ctx.policyNote}
        </p>
        {isLong && (
          <button type="button" onClick={() => setShowPolicy(v => !v)} className="text-[11px] text-blue-400 hover:underline mt-0.5">
            {showPolicy ? 'Hide policy detail' : 'Expand policy detail'}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Close exception resolver" className="text-slate-400 hover:text-white transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-800">
        <X className="w-5 h-5" />
      </button>
    </div>
  )
}

function ResolverFooter({
  ctx,
  path,
  selectedCount,
  canApply,
  applyLabel,
  onApply,
  onClose,
}: {
  ctx: ResolverContext
  path: ResolutionPath | null
  selectedCount: number
  canApply: boolean
  applyLabel: string
  onApply: () => void
  onClose: () => void
}) {
  const statusText = path === null
    ? 'Select a resolution action on the right to continue'
    : path === 'workflow'
      ? 'Query will be logged in Activity Log and case moves to Awaiting Documentation'
      : `${selectedCount} local evidence item${selectedCount !== 1 ? 's' : ''} selected for clinician override rationale`

  const buttonText = path === null
    ? 'Select an action above'
    : path === 'workflow' && ctx.workflow
      ? `Send Query to ${ctx.workflow.recipient}`
      : applyLabel

  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 shrink-0">
      <p className="text-xs text-slate-400">{statusText}</p>
      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply}
          className={`px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 text-white transition-colors ${
            path === 'workflow' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
          }`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}

export function ExceptionResolverModal({
  ctx,
  applyLabel,
  onApply,
  onClose,
}: {
  ctx: ResolverContext
  applyLabel: string
  onApply: (justification: string, path: ResolutionPath) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(ctx.options.filter(o => o.preselected).map(o => o.id))
  const [custom, setCustom] = useState('')
  const [path, setPath] = useState<ResolutionPath | null>(ctx.workflow ? null : 'justify')

  const toggle = (id: string) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  const attach = (id: string) => {
    if (!selected.includes(id)) setSelected(prev => [...prev, id])
    setPath('justify')
  }

  const justification = assembleJustification(ctx, selected, custom)
  const canApply = path === 'workflow' ? true : path === 'justify' && justification.length > 0

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-6" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <ResolverHeader ctx={ctx} onClose={onClose} />
        <div className="flex-1 flex flex-col lg:flex-row gap-5 p-5 overflow-y-auto min-h-[420px]">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {ctx.conflictSources && ctx.conflictSources.length > 0 && <ConflictComparisonCard conflictSources={ctx.conflictSources} />}
            <EvidenceDiscoveryConsole ctx={ctx} selected={selected} onAttach={attach} />
          </div>
          <div className="w-full lg:w-[410px] shrink-0 flex flex-col gap-3">
            <SelectedEvidenceStrip options={ctx.options} selected={selected} onRemove={toggle} />
            {ctx.workflow && <WorkflowQueryCard workflow={ctx.workflow} active={path === 'workflow'} onSelect={() => setPath('workflow')} />}
            {ctx.workflow && <JustifyPathToggle active={path === 'justify'} onSelect={() => setPath('justify')} />}
            <JustificationOptions
              options={ctx.options}
              selected={selected}
              onToggle={toggle}
              custom={custom}
              onCustomChange={setCustom}
              dimmed={!!ctx.workflow && path !== 'justify'}
              onActivateJustify={() => setPath('justify')}
            />
          </div>
        </div>
        <ResolverFooter
          ctx={ctx}
          path={path}
          selectedCount={selected.length}
          canApply={canApply}
          applyLabel={applyLabel}
          onApply={() => { if (path) onApply(justification, path) }}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
