import { LayoutDashboard, Library, Activity, FileText, Users, AlertTriangle, Pencil, BarChart2, LineChart, ShieldCheck, Rocket, Boxes, Workflow, Sliders, Sun, Moon } from 'lucide-react'
import { type View } from '../types'

// Who owns each surface — the Telus-Kroll boundary made explicit in the chrome.
// Paxos owns the technical/platform layers (Build, Scale); the client operates the
// day-to-day surface (Operate); the manufacturer sees a read-only sponsor view.
type Owner = 'Client' | 'Paxos' | 'Sponsor'

interface NavSection {
  name: string
  subtitle: string
  owner: Owner
  persona: string
  items: readonly (readonly [View, typeof LayoutDashboard, string])[]
}

const SECTIONS: readonly NavSection[] = [
  {
    name: 'Operate', subtitle: 'What the customer’s PA team uses', owner: 'Client', persona: 'PA Coordinator',
    items: [
      ['portfolio',  LayoutDashboard, 'Case Queue'],
      ['evals',      BarChart2,       'Quality Report'],
      ['automation', Sliders,         'Automation Policy'],
    ],
  },
  {
    name: 'Build', subtitle: 'What the Applied AI Lead authors', owner: 'Paxos', persona: 'Applied AI Lead',
    items: [
      ['library',      Library,       'Ontology Library'],
      ['specs',        FileText,      'Workflow Spec'],
      ['instructions', Pencil,        'Agent Instructions'],
      ['rubric',       Workflow,      'Eval Rubric'],
      ['failures',     AlertTriangle, 'Failure Review'],
    ],
  },
  {
    name: 'Scale', subtitle: 'Reuse across customers', owner: 'Paxos', persona: 'Implementation Lead',
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

const OWNER_CHIP: Record<Owner, string> = {
  Client:  'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Paxos:   'text-violet-300 bg-violet-500/10 border-violet-500/20',
  Sponsor: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
}

const OWNER_LABEL: Record<Owner, string> = {
  Client:  'Client-operated',
  Paxos:   'Paxos-managed',
  Sponsor: 'Manufacturer view',
}

export function Sidebar({ view, setView, onStartTour, theme, onToggleTheme }: { view: View; setView: (v: View) => void; onStartTour: () => void; theme: 'dark' | 'light'; onToggleTheme: () => void }) {
  // The chrome follows the surface you're on — so Build/Scale don't read as the
  // coordinator's. Lens = whichever section owns the active view. A case detail
  // ('poc') is opened from the Operate queue, so it keeps the Operate lens.
  const activeSectionName =
    SECTIONS.find(s => s.items.some(([v]) => v === view))?.name
    ?? (view === 'poc' ? 'Operate' : undefined)
  const activeSection = SECTIONS.find(s => s.name === activeSectionName) ?? SECTIONS[0]

  return (
    <aside className="w-60 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">PaxOS</p>
            <p className="text-xs text-slate-500 mt-0.5">{activeSection.name} · {OWNER_LABEL[activeSection.owner]}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto space-y-4">
        {SECTIONS.map(({ name, subtitle, owner, items }) => (
          <div
            key={name}
            className={`transition-opacity duration-300 ${activeSectionName && name !== activeSectionName ? 'opacity-40 hover:opacity-100' : ''}`}
          >
            <div className="px-3 mb-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{name}</p>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${OWNER_CHIP[owner]}`}>{owner}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">{subtitle}</p>
            </div>
            <div className="space-y-0.5">
              {items.map(([v, Icon, label]) => (
                <button
                  key={v}
                  id={v === 'library' ? 'tour-sidebar-library' : undefined}
                  onClick={() => setView(v)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    view === v
                      ? 'bg-slate-700/80 text-white font-medium'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
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
        {/* Persona chip follows the lens — who operates the surface you're viewing */}
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

// ---------------------------------------------------------------------------
// View — Sponsor / Coverage Insights
// Manufacturer persona. A drug sponsor does NOT operate a case queue — it funds
// hubs/sites that do. This surface is read-only, de-identified aggregates only:
// no patient records, no letters. PHI never crosses the sponsor boundary.
// ---------------------------------------------------------------------------
