import { LayoutDashboard, Library, Activity, FileText, Users, AlertTriangle, Pencil, BarChart2, LineChart, ShieldCheck, Rocket, Boxes, Workflow, Sliders, Sun, Moon } from 'lucide-react'
import { type View, type Role } from '../types'

type Owner = 'Client' | 'Platform' | 'Sponsor'

interface NavSection {
  name: Role
  subtitle: string
  owner: Owner
  persona: string
  items: readonly (readonly [View, typeof LayoutDashboard, string])[]
}

const SECTIONS: readonly NavSection[] = [
  {
    name: 'Operate', subtitle: "What the customer's PA team uses", owner: 'Client', persona: 'PA Coordinator',
    items: [
      ['portfolio',  LayoutDashboard, 'Case Queue'],
      ['evals',      BarChart2,       'Quality Report'],
      ['automation', Sliders,         'Automation Policy'],
    ],
  },
  {
    name: 'Build', subtitle: 'What the Applied AI Lead authors', owner: 'Platform', persona: 'Applied AI Lead',
    items: [
      ['library',      Library,       'Ontology Library'],
      ['specs',        FileText,      'Workflow Spec'],
      ['instructions', Pencil,        'Agent Instructions'],
      ['rubric',       Workflow,      'Eval Rubric'],
      ['failures',     AlertTriangle, 'Failure Review'],
    ],
  },
  {
    name: 'Scale', subtitle: 'Reuse across customers', owner: 'Platform', persona: 'Implementation Lead',
    items: [
      ['onboarding', Rocket, 'Onboard Client'],
      ['platform',   Boxes,  'Platform Registry'],
    ],
  },
  {
    name: 'Sponsor', subtitle: 'What a manufacturer sees', owner: 'Sponsor', persona: 'Brand Analyst',
    items: [
      ['sponsor', LineChart, 'Coverage Insights'],
    ],
  },
]

// Active state: colored bg + text per role; inactive: neutral
const ROLE_ACTIVE: Record<Role, string> = {
  Operate: 'bg-teal-500/15 text-teal-300 border border-teal-500/25',
  Build:   'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  Scale:   'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  Sponsor: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
}

const ROLE_DOT: Record<Role, string> = {
  Operate: 'bg-teal-400',
  Build:   'bg-violet-400',
  Scale:   'bg-violet-400',
  Sponsor: 'bg-sky-400',
}

// Top accent stripe on the sidebar header changes per active role
const ROLE_TOP_BORDER: Record<Role, string> = {
  Operate: 'border-t-2 border-teal-500/50',
  Build:   'border-t-2 border-violet-500/50',
  Scale:   'border-t-2 border-violet-500/50',
  Sponsor: 'border-t-2 border-sky-500/50',
}

const OWNER_LABEL: Record<Owner, string> = {
  Client:   'Client-operated',
  Platform: 'Platform-managed',
  Sponsor:  'Manufacturer view',
}

export function Sidebar({
  view, setView,
  activeRole, onRoleChange,
  onStartTour, theme, onToggleTheme,
}: {
  view: View
  setView: (v: View) => void
  activeRole: Role
  onRoleChange: (r: Role) => void
  onStartTour: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  const activeSection = SECTIONS.find(s => s.name === activeRole) ?? SECTIONS[0]

  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo — top accent stripe reflects the active role */}
      <div className={`px-5 py-5 border-b border-slate-800 ${ROLE_TOP_BORDER[activeRole]}`}>
        <button onClick={onStartTour} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity text-left w-full">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <p className="text-sm font-semibold text-white">ClearAuth (Demo) </p>
        </button>
      </div>

      {/* Role switcher — 2×2 grid; clicking a role navigates to its default view */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-800">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-0.5 mb-2">Viewing as</p>
        <div className="grid grid-cols-2 gap-1.5">
          {SECTIONS.map(({ name }) => (
            <button
              key={name}
              onClick={() => onRoleChange(name)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeRole === name
                  ? ROLE_ACTIVE[name]
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ROLE_DOT[name]}`} />
              {name}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2.5 px-0.5 leading-snug">{activeSection.subtitle}</p>
      </div>

      {/* Nav — only the active role's items */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-0.5">
          {activeSection.items.map(([v, Icon, label]) => (
            <button
              key={v}
              id={v === 'library' ? 'tour-sidebar-library' : undefined}
              onClick={() => setView(v)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                view === v || (v === 'portfolio' && view === 'poc')
                  ? 'bg-slate-700/80 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer — theme, tour, persona */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          onClick={onStartTour}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Activity className="w-4 h-4" />
          Guided Tour
        </button>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-300 truncate">{activeSection.persona}</p>
            <p className="text-xs text-slate-500">{OWNER_LABEL[activeSection.owner]}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
