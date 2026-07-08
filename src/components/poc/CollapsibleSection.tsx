import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Progressive-disclosure wrapper — renders a collapsible section with a label
 * and optional icon.  Defaults to collapsed so non-critical information stays
 * out of the coordinator's primary scan path.
 */
export function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string
  icon?: ReactNode
  badge?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <span className="text-sm font-medium text-slate-400">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-slate-700/40 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  )
}
