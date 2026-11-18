import { Users, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { type View, type Role } from '../types'
import { type ShellModeBadge } from '../capabilities'
import { SECTIONS, ROLE_TOP_BORDER, ROLE_TOGGLE_GLOW, OWNER_LABEL } from './navConfig'

// Sidebar — navigation rail. Collapses to a 56px (`w-14`) compact icon rail
// when a patient chart is open so clinical workspaces retain full width while
// keeping top-level navigation one click away.
export function Sidebar({
  view, setView,
  activeRole,
  onStartTour,
  isCollapsed, onToggleCollapse,
  modeBadge,
}: {
  view: View
  setView: (v: View) => void
  activeRole: Role
  onStartTour: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  modeBadge: ShellModeBadge
}) {
  const activeSection = SECTIONS.find(s => s.name === activeRole) ?? SECTIONS[0]

  return (
    <div className="relative flex shrink-0 z-40">
      <aside className={`transition-all duration-300 ease-in-out ${isCollapsed ? 'w-14' : 'w-60'} border-slate-800 shrink-0 bg-slate-900 border-r flex flex-col overflow-hidden`}>
        {/* Logo — top accent stripe reflects the active role */}
        <div className={`${isCollapsed ? 'px-2.5 py-4 flex justify-center' : 'px-5 py-5'} border-b border-slate-800 ${ROLE_TOP_BORDER[activeRole]}`}>
          <button
            onClick={onStartTour}
            title={`${modeBadge.wordmark} — Guided Tour`}
            className={`flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left ${isCollapsed ? 'justify-center' : 'w-full'}`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && <p className="text-sm font-semibold text-white truncate">{modeBadge.wordmark}</p>}
          </button>
        </div>

        {/* Nav — only the active role's items */}
        <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-3'} overflow-y-auto`}>
          <div className="space-y-0.5">
            {activeSection.items.map(([v, Icon, label]) => {
              const active = view === v || (v === 'portfolio' && view === 'poc')
              return (
                <button
                  key={v}
                  id={v === 'library' ? 'tour-sidebar-library' : undefined}
                  onClick={() => setView(v)}
                  title={isCollapsed ? label : undefined}
                  aria-label={label}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2'} rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-slate-700/80 text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{label}</span>}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Footer — the single home for persona identity */}
        <div className={`${isCollapsed ? 'p-2 flex justify-center' : 'p-3'} border-t border-slate-800`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center py-1' : 'gap-3 px-2 py-2'}`} title={isCollapsed ? `${activeSection.persona} (${OWNER_LABEL[activeSection.owner]})` : undefined}>
            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{activeSection.persona}</p>
                <p className="text-xs text-slate-500">{OWNER_LABEL[activeSection.owner]}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
      <button
        onClick={onToggleCollapse}
        className={`absolute top-3.5 z-50 w-5 h-8 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-r-lg flex items-center justify-center cursor-pointer text-slate-400 transition-all duration-300 shadow-sm ${ROLE_TOGGLE_GLOW[activeRole]} ${
          isCollapsed ? 'left-14 -ml-[1px]' : 'left-60 -ml-[1px]'
        }`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
