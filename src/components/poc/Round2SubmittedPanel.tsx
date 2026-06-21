import { CheckCircle, ChevronRight } from 'lucide-react'
import { usePoc } from './PocContext'
import { TransmissionReceipt } from './Transmission'

export function Round2SubmittedPanel() {
  const { scenario, onReset, appealRef } = usePoc()
  return (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-5 bg-violet-950/40 border border-violet-500/30 rounded-xl">
                  <div className="w-11 h-11 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-violet-300">Round 2 Counter Submitted</h2>
                    <p className="text-sm text-violet-300/70">Transmitted to {scenario.plan} · {appealRef}</p>
                  </div>
                </div>
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Clinical basis cited</p>
                  <p className="text-sm text-slate-300">{scenario.round2Appeal?.guidelineRef}</p>
                  <p className="text-xs text-slate-500 mt-1">PMID: {scenario.round2Appeal?.guidelinePMID} · Required dose: {scenario.round2Appeal?.requiredDose}</p>
                </div>
                <TransmissionReceipt plan={scenario.plan} />
                <button onClick={onReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                  <ChevronRight className="w-4 h-4" />Return to Case Queue
                </button>
              </div>
  )
}
