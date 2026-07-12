/**
 * Live appeal-generation runner: pick a case, stream the pipeline.
 *
 * Renders the `LiveGenState` produced by useLiveAppeal — the step events as a
 * progress list, the chunked letter as it streams, and the terminal tier. The
 * parked/resume surface is rendered by the parent (LiveApp).
 */
import { Loader2, CircleCheck } from 'lucide-react'
import type { ScenarioConfig } from '../../../types'
import type { LiveGenState } from './appealEvents'
import { DonePanel } from './DonePanel'

export function GenerateView({
  scenarioList,
  selectedId,
  onSelect,
  onGenerate,
  state,
}: {
  scenarioList: ScenarioConfig[]
  selectedId: string
  onSelect: (id: string) => void
  onGenerate: () => void
  state: LiveGenState
}) {
  const streaming = state.status === 'streaming'

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm">
          <span className="text-slate-400">Case</span>
          <select
            className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
            value={selectedId}
            onChange={e => onSelect(e.target.value)}
            disabled={streaming}
          >
            {scenarioList.map(s => (
              <option key={s.id} value={s.id}>{s.drug} — {s.plan}</option>
            ))}
          </select>
        </label>
        <button
          onClick={onGenerate}
          disabled={streaming}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {streaming ? 'Generating…' : 'Generate appeal'}
        </button>
      </div>

      {state.steps.length > 0 && (
        <ol className="space-y-1.5">
          {state.steps.map((s, i) => (
            <li key={`${s.step}-${i}`} className="flex items-center gap-2 text-sm text-slate-300">
              {streaming && i === state.steps.length - 1
                ? <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                : <CircleCheck className="w-3.5 h-3.5 text-emerald-500" />}
              {s.label}
            </li>
          ))}
        </ol>
      )}

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
