import { Activity, Sun, Moon } from 'lucide-react'
import { type Role } from '../types'
import { type ShellModeBadge } from '../capabilities'
import { SECTIONS, ROLE_ACTIVE } from './navConfig'

// Topbar — shell chrome. The persona switcher is scaffolding for the
// demo/pitch (a real customer's coordinator only ever sees one persona), so it
// lives here at its own altitude, visually marked with the build's mode badge
// (Demo for fixture builds, Live for backend-connected builds — the shell
// computes it, ADR-0016), instead of cluttering the navigation rail.
// Utilities (theme, guided tour) sit on the right.
export function Topbar({
  activeRole,
  onRoleChange,
  theme,
  onToggleTheme,
  onStartTour,
  modeBadge,
}: {
  activeRole: Role
  onRoleChange: (r: Role) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onStartTour: () => void
  modeBadge: ShellModeBadge
}) {
  const activeSection = SECTIONS.find(s => s.name === activeRole) ?? SECTIONS[0]

  return (
    <header className="shrink-0 z-40 flex items-center gap-4 px-4 h-12 bg-slate-900 border-b border-slate-800">
      {/* Mode-marked persona switcher */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 shrink-0 ${modeBadge.cls}`}>
          {modeBadge.label}
        </span>
        <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">Viewing as</span>
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-800/60 border border-slate-700/50 p-0.5">
          {SECTIONS.map(({ name }) => (
            <button
              key={name}
              onClick={() => onRoleChange(name)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                activeRole === name
                  ? ROLE_ACTIVE[name]
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
        {/* What the active persona is — narration kept at demo-chrome altitude,
            tied to the switch, out of the nav rail. */}
        <span className="text-xs text-slate-500 truncate hidden lg:inline pl-1">
          {activeSection.subtitle}
        </span>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <button
          onClick={onStartTour}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guided Tour</span>
        </button>
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  )
}
