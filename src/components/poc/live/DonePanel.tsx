/**
 * Terminal `done` panel for the live appeal stream — renders the whole
 * `DoneEvent` the backend returned (LiveGenState.done), not just the tier.
 *
 * Tier → next-step copy is a lookup map (STYLE MANDATE: no if/else chain). The
 * tier badge itself is the shared `TierBadge`; this only adds the sentence of
 * what the human does next.
 */
import { TierBadge } from '../../ui'
import type { CaseTier } from '../../../types'
import type { DoneEvent } from '../../../lib/wire'

const NEXT_STEP: Record<CaseTier, string> = {
  routine: 'Cleared for submission.',
  complex: 'Read the draft closely before filing.',
  exception: 'Parked for review — resume it from the pending queue.',
}

export function DonePanel({ done }: { done: DoneEvent }) {
  const scores = Object.entries(done.structural_scores ?? {})
  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        {done.tier && <TierBadge tier={done.tier} />}
        <span className="text-sm text-slate-300">{done.tier ? NEXT_STEP[done.tier] : 'Run complete.'}</span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-400">
        <span>Model <span className="text-slate-200">{done.model || '—'}</span></span>
        {done.retry_count > 0 && (
          <span className="text-amber-400">Passed after {done.retry_count} {done.retry_count === 1 ? 'retry' : 'retries'}</span>
        )}
        {done.pa_resolution === 'generic' && (
          <span className="text-amber-400">Generic-fallback letter (no plan-specific policy matched)</span>
        )}
        {done.pa_resolution && done.pa_resolution !== 'generic' && (
          <span>Policy match <span className="text-slate-200">{done.pa_resolution}</span></span>
        )}
      </div>

      {scores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {scores.map(([name, score]) => (
            <span key={name} className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
              {name} <span className="text-slate-100 font-medium">{score}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-mono text-slate-500">
        <span>{done.correlation_id}</span>
        {done.ref && <span>ref {done.ref.slice(0, 12)}</span>}
      </div>
    </div>
  )
}
