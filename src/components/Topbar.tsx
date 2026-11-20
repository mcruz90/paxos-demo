import { Activity, LogOut, Moon, Sun } from 'lucide-react'
import { type Role } from '../types'
import { type ShellModeBadge } from '../capabilities'
import { SECTIONS, ROLE_ACTIVE } from './navConfig'

// Topbar — shell chrome. Houses the persona switcher, guided tour launch,
// theme toggle, and (when in live mode) an explicit Sign out control.
export function Topbar({
  activeRole,
  onRoleChange,
  theme,
  onToggleTheme,
  onStartTour,
  modeBadge,
  liveSession,
}: {
  activeRole: Role
  onRoleChange: (r: Role) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onStartTour: () => void
  modeBadge: ShellModeBadge
  liveSession?: { userId: string; onLogout: () => void }
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
              type="button"
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
        <span className="text-xs text-slate-500 truncate hidden lg:inline pl-1">
          {activeSection.subtitle}
        </span>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button
          type="button"
          onClick={onStartTour}
          aria-label="Guided Tour"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Guided Tour</span>
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {liveSession && (
          <button
            type="button"
            onClick={liveSession.onLogout}
            title={`Signed in as ${liveSession.userId} — click to sign out`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700/70 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors ml-1"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign out</span>
            <span className="text-slate-500 font-mono hidden md:inline">({liveSession.userId})</span>
          </button>
        )}
      </div>
    </header>
  )
}
