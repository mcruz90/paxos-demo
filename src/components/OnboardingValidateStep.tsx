import { Boxes, CheckCircle, ChevronRight, Loader2, Rocket, Workflow } from 'lucide-react'
import { METHOD_LABEL, RUBRIC_DIMENSIONS, thresholdLabel } from '../data/evalRubric'
import { type View } from '../types'
import { CLEARAUTH_EVAL_STAGES } from './inspector/inspectorModel'
import { type OnboardingTemplate } from './onboardingData'
import { IllustrativeTag } from './ui'

function SixStageReadinessStrip() {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-slate-200 uppercase tracking-wide">clearauth-eval · 6-Stage Pipeline Readiness Gate</p>
        <IllustrativeTag />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {CLEARAUTH_EVAL_STAGES.map(st => (
          <div key={st.module} className="rounded-lg bg-slate-900/50 border border-slate-700/50 px-2.5 py-2">
            <p className="text-[11px] font-medium text-slate-300 truncate">{st.stage}</p>
            <p className="text-sm font-bold font-mono text-emerald-300 mt-0.5">{st.scorePct}%</p>
            <p className="text-[10px] font-mono text-slate-500">n={st.n}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ValidateLaunchStep({
  template, validating, validated, launched, onRunValidation, onLaunch, setView,
}: {
  template: OnboardingTemplate; validating: boolean; validated: boolean; launched: boolean
  onRunValidation: () => void; onLaunch: () => void; setView: (v: View) => void
}) {
  if (!validated) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-slate-400">
          Run the shared eval suite against {template.validation.sampleCases} sample cases through {template.company}&rsquo;s configuration — scored by the <button onClick={() => setView('rubric')} className="text-emerald-400 hover:underline">Eval Rubric</button>.
        </p>
        <button onClick={onRunValidation} disabled={validating} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Workflow className="w-4 h-4" />}
          {validating ? 'Running eval suite…' : `Run validation (${template.validation.sampleCases} sample cases)`}
        </button>
      </div>
    )
  }

  if (launched) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Rocket className="w-6 h-6 text-emerald-400" /></div>
          <div><h2 className="text-lg font-bold text-emerald-400">{template.company} is Live</h2><p className="text-sm text-emerald-300/70">Configured and deployed on the shared platform.</p></div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('platform')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"><Boxes className="w-4 h-4" />View Platform Registry</button>
          <button onClick={() => setView('portfolio')} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"><ChevronRight className="w-4 h-4" />Go to Case Queue</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
        <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-emerald-300">Cleared the Launch Gate</h2>
          <p className="text-xs text-emerald-300/70">{template.validation.sampleCases}/{template.validation.sampleCases} sample cases passed every dimension of the shared Eval Rubric.</p>
        </div>
      </div>
      <SixStageReadinessStrip />
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2"><Workflow className="w-4 h-4 text-slate-400" /><span className="text-sm font-medium text-slate-300">Eval Gate · shared rubric</span></div>
          <button onClick={() => setView('rubric')} className="text-xs text-emerald-400 hover:underline whitespace-nowrap">View Eval Rubric →</button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
              <th className="text-left px-4 py-2.5 font-medium">Dimension</th>
              <th className="text-left px-4 py-2.5 font-medium">Method</th>
              <th className="text-center px-4 py-2.5 font-medium">Required</th>
              <th className="text-center px-4 py-2.5 font-medium">Result</th>
              <th className="text-center px-4 py-2.5 font-medium">Gate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {RUBRIC_DIMENSIONS.map(d => (
              <tr key={d.dimension} className="hover:bg-slate-700/20">
                <td className="px-4 py-2.5 text-slate-300">{d.dimension}</td>
                <td className="px-4 py-2.5 text-slate-500">{METHOD_LABEL[d.method]}</td>
                <td className="px-4 py-2.5 text-center font-mono text-slate-400">{thresholdLabel(d.threshold)}</td>
                <td className="px-4 py-2.5 text-center font-mono text-emerald-300">{Math.round(Math.min(1, d.threshold + 0.04) * 100)}%</td>
                <td className="px-4 py-2.5 text-center"><CheckCircle className="w-4 h-4 text-emerald-400 inline" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Net-New Code', value: '0 lines', sub: `${template.company} uses configuration, not bespoke code.` },
          { label: 'Configuration Split', value: `${template.validation.reusePct}% / ${100 - template.validation.reusePct}%`, sub: `${template.validation.netNew}.` },
          { label: 'Setup Time', value: template.validation.timeEstimate, sub: 'configuration vs. multi-week build (illustrative)' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-400 mb-2">{m.label}</p>
            <p className="text-2xl font-bold font-mono text-emerald-300 leading-none">{m.value}</p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.sub}</p>
          </div>
        ))}
      </div>
      <button onClick={onLaunch} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
        <Rocket className="w-4 h-4" />Launch {template.company}
      </button>
    </div>
  )
}
