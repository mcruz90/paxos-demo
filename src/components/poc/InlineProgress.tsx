import { Loader2, CheckCircle } from 'lucide-react'
import type { PipelineStep } from './pipeline'

/**
 * Compact inline progress indicator — replaces the full-screen pipeline
 * stepper. Renders a smooth progress bar with the current step label and
 * loading text, auto-completing visually when all steps finish.
 *
 * Used in both Round 1 (initial pipeline) and Round 2 (dispute counter-arg)
 * flows so the user sees progress without leaving their current context.
 */
export function InlineProgress({
  steps,
  currentStep,
  variant = 'blue',
  label,
}: {
  steps: PipelineStep[]
  currentStep: number
  variant?: 'blue' | 'violet'
  label?: string
}) {
  const total = steps.length
  const done = currentStep >= total - 1
  const progress = Math.min(((currentStep + 1) / total) * 100, 100)
  const step = steps[Math.min(currentStep, total - 1)]

  const colors = variant === 'violet'
    ? { bar: 'bg-violet-500', barTrack: 'bg-violet-950/40', text: 'text-violet-300', icon: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-950/20' }
    : { bar: 'bg-blue-500', barTrack: 'bg-blue-950/40', text: 'text-blue-300', icon: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-950/20' }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {done
            ? <CheckCircle className="w-4 h-4 text-emerald-400" />
            : <Loader2 className={`w-4 h-4 ${colors.icon} animate-spin`} />}
          <span className={`text-sm font-semibold ${done ? 'text-emerald-300' : colors.text}`}>
            {done ? (label ? `${label} ready` : 'Pipeline complete') : (label ?? 'Generating...')}
          </span>
        </div>
        <span className="text-xs text-slate-500">{Math.min(currentStep + 1, total)}/{total}</span>
      </div>

      {/* Progress bar */}
      <div className={`h-1.5 rounded-full ${colors.barTrack} overflow-hidden`}>
        <div
          className={`h-full rounded-full ${done ? 'bg-emerald-500' : colors.bar} transition-all duration-700 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current step description */}
      {!done && (
        <p className="text-xs text-slate-400 leading-relaxed">
          {step.loadingText}
        </p>
      )}
    </div>
  )
}
