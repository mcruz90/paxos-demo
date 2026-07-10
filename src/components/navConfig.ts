import { LayoutDashboard, Library, FileText, AlertTriangle, Pencil, BarChart2, LineChart, Rocket, Boxes, Workflow, Sliders, Gauge } from 'lucide-react'
import { type View, type Role } from '../types'

// ---------------------------------------------------------------------------
// Navigation metadata — the single source of truth for the persona sections
// shared by the Topbar (persona switcher) and the Sidebar (per-persona nav).
// Extracted here when the Topbar became the second consumer (DRY).
// ---------------------------------------------------------------------------

export type Owner = 'Client' | 'Platform' | 'Sponsor'

export interface NavSection {
  name: Role
  subtitle: string
  owner: Owner
  persona: string
  items: readonly (readonly [View, typeof LayoutDashboard, string])[]
}

export const SECTIONS: readonly NavSection[] = [
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
      ['build_home',   Gauge,         'Control Plane'],
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

// Active-persona chip color per role (Topbar segmented control).
export const ROLE_ACTIVE: Record<Role, string> = {
  Operate: 'bg-teal-500/15 text-teal-300 border border-teal-500/25',
  Build:   'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  Scale:   'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  Sponsor: 'bg-sky-500/15 text-sky-300 border border-sky-500/25',
}

// Top accent stripe on the sidebar logo header, per active role.
export const ROLE_TOP_BORDER: Record<Role, string> = {
  Operate: 'border-t-2 border-teal-500/50',
  Build:   'border-t-2 border-violet-500/50',
  Scale:   'border-t-2 border-violet-500/50',
  Sponsor: 'border-t-2 border-sky-500/50',
}

// Hover accent on the sidebar collapse toggle, per active role.
export const ROLE_TOGGLE_GLOW: Record<Role, string> = {
  Operate: 'hover:shadow-teal-500/20 hover:border-teal-500/30 hover:text-teal-300',
  Build:   'hover:shadow-violet-500/20 hover:border-violet-500/30 hover:text-violet-300',
  Scale:   'hover:shadow-violet-500/20 hover:border-violet-500/30 hover:text-violet-300',
  Sponsor: 'hover:shadow-sky-500/20 hover:border-sky-500/30 hover:text-sky-300',
}

export const OWNER_LABEL: Record<Owner, string> = {
  Client:   'Client-operated',
  Platform: 'Platform-managed',
  Sponsor:  'Manufacturer view',
}
