import { ShieldCheck, Code, LayoutDashboard, Boxes, Compass, LineChart, ArrowRight } from 'lucide-react'
import { type IconType, type Role } from '../types'
import { TOURS, type TourId } from './tour'

const TOUR_ICON: Record<TourId, IconType> = {
  build: Code,
  operate: LayoutDashboard,
  scale: Boxes,
  overview: Compass,
}

const ACCENT: Record<string, { ring: string; icon: string; btn: string; chip: string }> = {
  violet:  { ring: 'hover:border-violet-500/60',  icon: 'bg-violet-500/15 text-violet-300',   btn: 'bg-emerald-500 hover:bg-emerald-600', chip: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
  teal:    { ring: 'hover:border-teal-500/60',    icon: 'bg-teal-500/15 text-teal-300',       btn: 'bg-teal-600 hover:bg-teal-500',       chip: 'text-teal-300 bg-teal-500/15 border-teal-500/30' },
  purple:  { ring: 'hover:border-purple-500/60',  icon: 'bg-purple-500/15 text-purple-300',   btn: 'bg-purple-600 hover:bg-purple-500',  chip: 'text-purple-200 bg-purple-500/15 border-purple-500/30' },
  sky:     { ring: 'hover:border-sky-500/60',     icon: 'bg-sky-500/15 text-sky-300',         btn: 'bg-sky-700 hover:bg-sky-600',        chip: 'text-sky-300 bg-sky-500/15 border-sky-500/30' },
}

const TOUR_CARDS: { id: TourId; accent: string; emphasized: boolean }[] = [
  { id: 'build',   accent: 'violet',  emphasized: true },
  { id: 'operate', accent: 'teal',    emphasized: false },
  { id: 'scale',   accent: 'purple',  emphasized: false },
]

export function LandingHub({ onStartTour, onRoleChange }: { onStartTour: (id: TourId) => void; onRoleChange: (role: Role) => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white leading-none">ClearAuth</h1>
            <p className="text-sm text-slate-400 mt-1">AI-native prior authorization, across the full PA lifecycle</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed mb-8">
          The platform surfaces four roles:{' '}
          <span className="text-teal-300">Operate</span> (the coordinator's queue),{' '}
          <span className="text-violet-300">Build</span> (the AI Lead's control plane),{' '}
          <span className="text-purple-300">Scale</span> (how it extends across clients), and{' '}
          <span className="text-sky-300">Sponsor</span> (market access intelligence).{' '}
          Pick yours — each card opens that surface and walks you through it.
        </p>

        {/* 2×2 audience grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TOUR_CARDS.map(({ id, accent, emphasized }) => {
            const t = TOURS[id]
            const a = ACCENT[accent]
            const Icon = TOUR_ICON[id]
            return (
              <button
                key={id}
                onClick={() => onStartTour(id)}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col ${a.ring} ${
                  emphasized
                    ? 'bg-violet-950/40 border-violet-500/60 ring-2 ring-violet-500/25'
                    : 'bg-slate-800/50 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${a.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border uppercase tracking-wide ${a.chip}`}>{t.label}</span>
                </div>
                <p className="text-sm font-semibold text-white">{t.audience}</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-1.5 flex-1">{t.blurb}</p>
                <span className={`mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors ${a.btn}`}>
                  Start the {t.label} tour<ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            )
          })}

          {/* Sponsor: no tour — navigates directly to Coverage Insights */}
          <button
            onClick={() => onRoleChange('Sponsor')}
            className="text-left p-5 rounded-2xl border transition-all flex flex-col hover:border-sky-500/60 bg-slate-800/50 border-slate-700/60"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-sky-500/15 text-sky-300">
                <LineChart className="w-5 h-5" />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full border uppercase tracking-wide text-sky-300 bg-sky-500/15 border-sky-500/30">Sponsor</span>
            </div>
            <p className="text-sm font-semibold text-white">Brand / Market Access Analyst</p>
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5 flex-1">
              Where your formulary stands — coverage gaps, denial patterns by payer, and the market access intelligence needed to prioritize access campaigns.
            </p>
            <span className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors bg-sky-700 hover:bg-sky-600">
              Explore Coverage Insights<ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>

        {/* Fictional-data notice */}
        <p className="text-xs text-slate-600 mt-6 leading-relaxed max-w-2xl">
          <span className="font-semibold text-slate-500">Demo notice:</span> All patient cases, clinical data, provider names, and payer details shown in this demo are entirely fictional and do not represent any real organization, patient, or health system. This is a portfolio prototype — not a production system.
        </p>

        {/* Tertiary: 90-second arc for explorers */}
        <div className="mt-6">
          <button
            onClick={() => onStartTour('overview')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-sm text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            <Compass className="w-4 h-4 text-slate-400" />
            {TOURS.overview.label} — the whole arc, fast
          </button>
        </div>
      </div>
    </div>
  )
}
