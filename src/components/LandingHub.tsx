import { ShieldCheck, Code, LayoutDashboard, Boxes, Compass, ArrowRight } from 'lucide-react'
import { type IconType } from '../types'
import { TOURS, type TourId } from './tour'

// The default view — solves "dropped into a dense queue with no orientation."
// Asks who you are, then routes to the right first view AND starts the matching
// tour. The three layers (Operate / Build / Scale) are the narrative arc; the
// cards let each audience start where it matters.

const TOUR_ICON: Record<TourId, IconType> = {
  build: Code,
  operate: LayoutDashboard,
  scale: Boxes,
  overview: Compass,
}

// One brand family (deep purple) — variants differentiate the cards without the
// blue/green mix. Build is the most saturated (the emphasis).
const ACCENT: Record<string, { ring: string; icon: string; btn: string; chip: string }> = {
  violet:  { ring: 'hover:border-violet-500/60',  icon: 'bg-violet-500/15 text-violet-300',   btn: 'bg-violet-600 hover:bg-violet-500',   chip: 'text-violet-200 bg-violet-500/15 border-violet-500/30' },
  purple:  { ring: 'hover:border-purple-500/60',  icon: 'bg-purple-500/15 text-purple-300',   btn: 'bg-purple-600 hover:bg-purple-500',   chip: 'text-purple-200 bg-purple-500/15 border-purple-500/30' },
  fuchsia: { ring: 'hover:border-fuchsia-500/60', icon: 'bg-fuchsia-500/15 text-fuchsia-300', btn: 'bg-fuchsia-600 hover:bg-fuchsia-500', chip: 'text-fuchsia-200 bg-fuchsia-500/15 border-fuchsia-500/30' },
  slate:   { ring: 'hover:border-slate-500/50',   icon: 'bg-slate-600/30 text-slate-300',     btn: 'bg-slate-600 hover:bg-slate-500',     chip: 'text-slate-300 bg-slate-700/40 border-slate-600/40' },
}

// Cards in audience order; Build is emphasized (the hiring lens).
const CARD_ORDER: TourId[] = ['build', 'operate', 'scale']

export function LandingHub({ onStartTour, onSkip }: { onStartTour: (id: TourId) => void; onSkip: () => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white leading-none">PaxOS</h1>
            <p className="text-sm text-slate-400 mt-1">AI-native prior authorization, across the full PA lifecycle</p>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl mb-8">
          The platform has three layers — <span className="text-purple-300">Operate</span> (what the client touches),{' '}
          <span className="text-violet-300">Build</span> (what the Applied AI Lead owns), and{' '}
          <span className="text-fuchsia-300">Scale</span> (reuse across clients). Who are you? Start where it matters — each
          card opens that surface and walks you through it.
        </p>

        {/* Audience cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARD_ORDER.map(id => {
            const t = TOURS[id]
            const a = ACCENT[t.accent]
            const Icon = TOUR_ICON[id]
            const emphasized = id === 'build'
            return (
              <button
                key={id}
                onClick={() => onStartTour(id)}
                className={`text-left p-5 rounded-2xl border bg-slate-800/50 transition-all flex flex-col ${a.ring} ${emphasized ? 'border-violet-500/40 ring-1 ring-violet-500/20' : 'border-slate-700/60'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${a.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${a.chip}`}>{t.label}</span>
                </div>
                <p className="text-sm font-semibold text-white">{t.audience}</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-1.5 flex-1">{t.blurb}</p>
                <span className={`mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors ${a.btn}`}>
                  Start the {t.label} tour<ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            )
          })}
        </div>

        {/* Secondary options — styled as buttons so they read as clickable */}
        <div className="flex flex-wrap items-center gap-3 mt-7">
          <button
            onClick={() => onStartTour('overview')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-sm text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            <Compass className="w-4 h-4 text-slate-400" />
            {TOURS.overview.label} — the whole arc, fast
          </button>
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-sm text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
          >
            Skip the tour — go to the Case Queue<ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
