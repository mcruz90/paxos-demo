import { ShieldCheck, Code, LayoutDashboard, Boxes, LineChart, ArrowRight, Zap } from 'lucide-react'
import { type IconType, type Role } from '../types'
import { TOURS, type TourId } from './tour'

// One card per surface. build/operate/scale open their guided tour; sponsor
// navigates straight to Coverage Insights (no tour). Accent is the emerald
// token throughout — theme-aware by design (emerald in dark, ClearAuth plum in
// light, remapped in style.css), so no per-card hues. Differentiation comes
// from icon + copy, not color.
interface LandingCard {
  key: string
  Icon: IconType
  label: string
  audience: string
  blurb: string
  cta: string
  onClick: () => void
  emphasized?: boolean
}

export function LandingHub({ onStartTour, onRoleChange }: { onStartTour: (id: TourId) => void; onRoleChange: (role: Role) => void }) {
  const cards: LandingCard[] = [
    // Build is emphasized: it's the surface this role (Applied AI Lead) owns.
    { key: 'build',   Icon: Code,            label: TOURS.build.label,   audience: TOURS.build.audience,   blurb: TOURS.build.blurb,   cta: `Start the ${TOURS.build.label} tour`,   onClick: () => onStartTour('build'), emphasized: true },
    { key: 'operate', Icon: LayoutDashboard, label: TOURS.operate.label, audience: TOURS.operate.audience, blurb: TOURS.operate.blurb, cta: `Start the ${TOURS.operate.label} tour`, onClick: () => onStartTour('operate') },
    { key: 'scale',   Icon: Boxes,           label: TOURS.scale.label,   audience: TOURS.scale.audience,   blurb: TOURS.scale.blurb,   cta: `Start the ${TOURS.scale.label} tour`,   onClick: () => onStartTour('scale') },
    { key: 'sponsor', Icon: LineChart,       label: 'Sponsor',           audience: 'Brand / Market Access Analyst',
      blurb: 'Where your formulary stands — coverage gaps, denial patterns by payer, and the market access intelligence needed to prioritize access campaigns.',
      cta: 'Explore Coverage Insights', onClick: () => onRoleChange('Sponsor') },
  ]

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-8 py-12">
        {/* Hero */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white leading-none">ClearAuth</h1>
            <p className="text-sm text-slate-400 mt-1">AI-native prior authorization, across the full PA lifecycle</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-7 max-w-3xl">
          ClearAuth runs the full prior-authorization lifecycle — intake, criteria checks, letter drafting, and payer
          submission — and routes every case through a human authorization gate before anything reaches a payer. The demo
          is organized as four surfaces, one per role.
        </p>

        {/* Primary path: fastest way to understand what this is */}
        <button
          onClick={() => onStartTour('overview')}
          className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/[0.16] hover:border-emerald-500/50 transition-all text-left mb-9"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">New here? Start with the 90-second overview</p>
            <p className="text-xs text-slate-400 mt-0.5">The whole arc in four beats — Operate, Build, Scale — in about 90 seconds.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:gap-2.5 transition-all shrink-0">
            Watch<ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Secondary path: explore by role */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Or explore by role</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pick the surface that matches you — each opens it and walks you through.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map(({ key, Icon, label, audience, blurb, cta, onClick, emphasized }) => (
            <button
              key={key}
              onClick={onClick}
              className={`group text-left p-5 rounded-2xl border transition-all flex flex-col ${
                emphasized
                  ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : 'bg-slate-800/50 border-slate-700/60 hover:border-emerald-500/50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/15 text-emerald-400">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  {emphasized && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-medium">
                      Start here
                    </span>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wide text-slate-400 bg-slate-800 border border-slate-700">
                    {label}
                  </span>
                </div>
              </div>
              <p className="text-sm font-semibold text-white">{audience}</p>
              <p className="text-xs text-slate-400 leading-relaxed mt-1.5 flex-1">{blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:gap-2.5 transition-all">
                {cta}<ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>

        {/* Fictional-data notice — full-width footer strip */}
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-400">Demo notice:</span> All patient cases, clinical data, provider
            names, and payer details shown in this demo are entirely fictional and do not represent any real organization,
            patient, or health system. This is a portfolio prototype — not a production system.
          </p>
        </div>
      </div>
    </div>
  )
}
