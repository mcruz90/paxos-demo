import { FileText, CheckCircle, Loader2, ChevronRight, Search, Shield, ChevronLeft, GitBranch } from 'lucide-react'
import { usePoc } from './PocContext'

export function Round2LoadingPanel() {
  const { scenario, setPhase, round2StepIdx, round2TourIdx, setRound2TourIdx, pipelineSteps } = usePoc()
  return (
              (() => {
                const stepIcons = [FileText, Search, GitBranch, Shield]
                const TourIcon = stepIcons[round2TourIdx]
                const tourStepDone = round2TourIdx < round2StepIdx
                return (
                  <div className="space-y-4">
                    {/* Horizontal stepper — violet scheme */}
                    <div className="grid grid-cols-4">
                      {pipelineSteps.map((step, i) => {
                        const isComplete = i < round2StepIdx
                        const isCurrent = i === round2StepIdx
                        const StepIcon = stepIcons[i]
                        return (
                          <div
                            key={i}
                            className="relative flex flex-col items-center cursor-pointer group"
                            onClick={() => i <= round2StepIdx && setRound2TourIdx(i)}
                          >
                            {i < pipelineSteps.length - 1 && (
                              <div className={`absolute top-5 left-1/2 w-full h-px z-0 transition-colors duration-700 ${
                                isComplete ? 'bg-violet-500' : 'bg-slate-700'
                              }`} />
                            )}
                            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                              isComplete ? 'bg-violet-500/20 border-violet-500' :
                              isCurrent ? 'bg-violet-500/10 border-violet-400' :
                              'bg-slate-800 border-slate-700'
                            } ${round2TourIdx === i && i <= round2StepIdx ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white/20' : ''}`}>
                              {isComplete
                                ? <CheckCircle className="w-5 h-5 text-violet-400" />
                                : isCurrent
                                ? <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                : <StepIcon className="w-5 h-5 text-slate-600" />}
                            </div>
                            <span className={`text-xs font-medium mt-1.5 text-center leading-tight ${
                              isComplete ? 'text-violet-400' :
                              isCurrent ? 'text-violet-300' :
                              'text-slate-600'
                            } ${i <= round2StepIdx ? 'group-hover:brightness-125' : ''}`}>{step.label}</span>
                          </div>
                        )
                      })}
                    </div>
    
                    {/* Tour card — violet */}
                    <div className="bg-slate-800/70 border border-violet-800/60 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-violet-800/40 bg-slate-800/40">
                        <div className="flex items-center gap-2.5">
                          <TourIcon className={`w-4 h-4 ${tourStepDone ? 'text-violet-400' : 'text-violet-400'}`} />
                          <span className="text-sm font-semibold text-white">{pipelineSteps[round2TourIdx].label}</span>
                          {tourStepDone && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium">Complete</span>}
                        </div>
                        <span className="text-xs text-slate-500">Step {round2TourIdx + 1} of {pipelineSteps.length}</span>
                      </div>
                      <div className="px-4 py-4 min-h-[80px]">
                        {tourStepDone ? (
                          <p className="text-sm text-slate-300 leading-relaxed">{pipelineSteps[round2TourIdx].explanation}</p>
                        ) : (
                          <div className="flex items-start gap-2.5">
                            <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0 mt-0.5" />
                            <p className="text-sm text-violet-300">{pipelineSteps[round2TourIdx].loadingText}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5 border-t border-violet-800/30 bg-slate-900/30">
                        <button
                          onClick={() => setRound2TourIdx(prev => Math.max(0, prev - 1))}
                          disabled={round2TourIdx === 0}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />Previous
                        </button>
                        <div className="flex gap-1.5">
                          {pipelineSteps.map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              round2TourIdx === i ? 'bg-violet-400' : i < round2StepIdx ? 'bg-violet-700' : i === round2StepIdx ? 'bg-violet-900' : 'bg-slate-700'
                            }`} />
                          ))}
                        </div>
                        <button
                          onClick={() => setRound2TourIdx(prev => Math.min(round2StepIdx, prev + 1))}
                          disabled={round2TourIdx >= round2StepIdx}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                        >
                          Next<ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
    
                    {round2StepIdx === pipelineSteps.length - 1 ? (
                      <button
                        id="tour-round2-continue"
                        onClick={() => setPhase('round2_done')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />Continue to Counter-Argument
                      </button>
                    ) : (
                      <p className="text-xs text-slate-500 text-center">Round 2 · Counter-argument pipeline · {scenario.configFile}</p>
                    )}
                  </div>
                )
              })()
  )
}
