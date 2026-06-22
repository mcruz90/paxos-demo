import { FileText, CheckCircle, Loader2, Zap, ChevronRight, Search, Shield, ChevronLeft, GitBranch } from 'lucide-react'
import { usePoc } from './PocContext'

export function PipelineStartPanel() {
  const { scenario, phase, setPhase, stepIdx, tourIdx, setTourIdx, pipelineSteps, handleExecute } = usePoc()
  const isInitialPa = scenario.lifecycle === 'initial_pa'
  return (
              <>
                {phase === 'idle' && (
                  <button id="tour-execute-btn" onClick={handleExecute}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
                    <Zap className="w-4 h-4" />Execute Full Pipeline
                  </button>
                )}
                {phase === 'loading' && (() => {
                  const stepIcons = [FileText, Search, GitBranch, Shield]
                  const TourIcon = stepIcons[tourIdx]
                  const tourStepDone = tourIdx < stepIdx
                  return (
                    <div className="space-y-4">
                      {/* Horizontal stepper */}
                      <div className="grid grid-cols-4">
                        {pipelineSteps.map((step, i) => {
                          const isComplete = i < stepIdx
                          const isCurrent = i === stepIdx
                          const StepIcon = stepIcons[i]
                          return (
                            <div
                              key={i}
                              className="relative flex flex-col items-center cursor-pointer group"
                              onClick={() => i <= stepIdx && setTourIdx(i)}
                            >
                              {i < pipelineSteps.length - 1 && (
                                <div className={`absolute top-5 left-1/2 w-full h-px z-0 transition-colors duration-700 ${
                                  isComplete ? 'bg-emerald-500' : 'bg-slate-700'
                                }`} />
                              )}
                              <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                                isComplete ? 'bg-emerald-500/20 border-emerald-500' :
                                isCurrent ? 'bg-blue-500/20 border-blue-400' :
                                'bg-slate-800 border-slate-700'
                              } ${tourIdx === i && i <= stepIdx ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white/20' : ''}`}>
                                {isComplete
                                  ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                                  : isCurrent
                                  ? <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                                  : <StepIcon className="w-5 h-5 text-slate-600" />}
                              </div>
                              <span className={`text-xs font-medium mt-1.5 text-center leading-tight ${
                                isComplete ? 'text-emerald-400' :
                                isCurrent ? 'text-blue-300' :
                                'text-slate-600'
                              } ${i <= stepIdx ? 'group-hover:brightness-125' : ''}`}>{step.label}</span>
                            </div>
                          )
                        })}
                      </div>
    
                      {/* Tour card */}
                      <div className="bg-slate-800/70 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/40">
                          <div className="flex items-center gap-2.5">
                            <TourIcon className={`w-4 h-4 ${tourStepDone ? 'text-emerald-400' : 'text-blue-400'}`} />
                            <span className="text-sm font-semibold text-white">{pipelineSteps[tourIdx].label}</span>
                            {tourStepDone && <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">Complete</span>}
                          </div>
                          <span className="text-xs text-slate-500">Step {tourIdx + 1} of {pipelineSteps.length}</span>
                        </div>
                        <div className="px-4 py-4 min-h-[80px]">
                          {tourStepDone ? (
                            <p className="text-sm text-slate-300 leading-relaxed">{pipelineSteps[tourIdx].explanation}</p>
                          ) : (
                            <div className="flex items-start gap-2.5">
                              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
                              <p className="text-sm text-blue-300">{pipelineSteps[tourIdx].loadingText}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700/40 bg-slate-900/30">
                          <button
                            onClick={() => setTourIdx(prev => Math.max(0, prev - 1))}
                            disabled={tourIdx === 0}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />Previous
                          </button>
                          <div className="flex gap-1.5">
                            {pipelineSteps.map((_, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                tourIdx === i ? 'bg-blue-400' : i < stepIdx ? 'bg-emerald-600' : i === stepIdx ? 'bg-blue-800' : 'bg-slate-700'
                              }`} />
                            ))}
                          </div>
                          <button
                            onClick={() => setTourIdx(prev => Math.min(stepIdx, prev + 1))}
                            disabled={tourIdx >= stepIdx}
                            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-default transition-colors"
                          >
                            Next<ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
    
                      {stepIdx === pipelineSteps.length - 1 ? (
                        <button
                          onClick={() => setPhase('done')}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />{isInitialPa ? 'Continue to PA Request' : 'Continue to Appeal Letter'}
                        </button>
                      ) : (
                        <p className="text-xs text-slate-500 text-center">Universal pipeline · {scenario.configFile}</p>
                      )}
                    </div>
                  )
                })()}
              </>
  )
}
