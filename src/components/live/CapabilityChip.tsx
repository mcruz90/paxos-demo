import { capabilityLabel, type UnitCapability } from '../../capabilities'

/**
 * Honest capability labeling (ADR-0016 / docs/architecture/13): in live mode
 * every unit surface wears its capability so fixture data can never be
 * mistaken for a live case. Units receive the capability as a prop from the
 * shell — they never compute it. Hidden units render nothing (they shouldn't
 * be mounted at all).
 */
export function CapabilityChip({ cap }: { cap: UnitCapability }) {
  const label = capabilityLabel(cap)
  if (!label) return null
  const cls = cap === 'live'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : 'bg-violet-500/10 text-violet-300 border-violet-500/20'
  return (
    <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}
