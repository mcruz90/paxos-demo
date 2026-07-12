/**
 * Shared pipeline-step progress list for the live result panels.
 *
 * Both lifecycle streams (appeal, initial-PA) emit the same `step` events; the
 * last step spins while streaming, the rest show as complete. Extracted on the
 * second consumer (DRY).
 */
import { Loader2, CircleCheck } from 'lucide-react'
import type { LiveStep } from './appealEvents'

export function StepList({ steps, streaming }: { steps: LiveStep[]; streaming: boolean }) {
  if (steps.length === 0) return null
  return (
    <ol className="space-y-1.5">
      {steps.map((s, i) => (
        <li key={`${s.step}-${i}`} className="flex items-center gap-2 text-sm text-slate-300">
          {streaming && i === steps.length - 1
            ? <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            : <CircleCheck className="w-3.5 h-3.5 text-emerald-500" />}
          {s.label}
        </li>
      ))}
    </ol>
  )
}
