/**
 * Live appeal result panel — lifecycle-pure (renders `LiveGenState` only).
 *
 * The case selector and Generate button live in LiveApp (shared across both
 * lifecycles, dispatched by `selected.lifecycle`); this renders the appeal
 * stream: step progress, the chunked letter, and the terminal DonePanel.
 */
import type { LiveGenState } from './appealEvents'
import { DonePanel } from './DonePanel'
import { StepList } from './StepList'

export function GenerateView({ state }: { state: LiveGenState }) {
  return (
    <div className="space-y-4">
      <StepList steps={state.steps} streaming={state.status === 'streaming'} />

      {state.error && <p className="text-sm text-rose-400">Generation failed: {state.error}</p>}

      {state.letter && (
        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Drafted letter</p>
          <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">{state.letter}</pre>
        </div>
      )}

      {state.status === 'done' && state.done && <DonePanel done={state.done} />}
    </div>
  )
}
