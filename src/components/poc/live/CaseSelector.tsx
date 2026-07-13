/**
 * Shared case selector + Generate button for both live lifecycles.
 *
 * The dropdown groups fixtures by lifecycle (Appeal / Initial PA) so the user
 * can tell them apart; the button label/dispatch is decided by the parent
 * (LiveApp) from the selected scenario's lifecycle — the single branch point.
 */
import type { ScenarioConfig } from '../../../types'

export function CaseSelector({
  appeals,
  initialPas,
  selectedId,
  streaming,
  buttonLabel,
  onSelect,
  onGenerate,
}: {
  appeals: ScenarioConfig[]
  initialPas: ScenarioConfig[]
  selectedId: string
  streaming: boolean
  buttonLabel: string
  onSelect: (id: string) => void
  onGenerate: () => void
}) {
  return (
    <div className="flex items-end gap-3">
      <label className="flex-1 text-sm">
        <span className="text-slate-400">Case</span>
        <select
          className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white"
          value={selectedId}
          onChange={e => onSelect(e.target.value)}
          disabled={streaming}
        >
          <optgroup label="Appeal">
            {appeals.map(s => <option key={s.id} value={s.id}>{s.drug} — {s.plan}</option>)}
          </optgroup>
          <optgroup label="Initial PA">
            {initialPas.map(s => <option key={s.id} value={s.id}>{s.drug} — {s.plan}</option>)}
          </optgroup>
        </select>
      </label>
      <button
        onClick={onGenerate}
        disabled={streaming}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {streaming ? 'Running…' : buttonLabel}
      </button>
    </div>
  )
}
