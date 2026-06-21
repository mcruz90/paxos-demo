import { FileText, CheckCircle, Users, AlertTriangle, Search, Shield, Download, RotateCcw, Code, ChevronDown, GitBranch } from 'lucide-react'
import { RuleTag } from '../ui'
import { usePoc } from './PocContext'
import { openPaRequestPdf } from './letter'

export function DonePanel() {
  const { scenario, onReset, onSaveToPortfolio, reviewMode, setPhase, traceOpen, setTraceOpen, stepIdx, pipelineSteps, handleDownload } = usePoc()
  const isInitialPa = scenario.lifecycle === 'initial_pa'
  return (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-emerald-400">
                      {reviewMode
                        ? (isInitialPa ? 'AI Pipeline Complete · PA Request Assembled' : 'AI Pipeline Complete · Ready for Your Review')
                        : (isInitialPa ? 'PA Request Assembled' : 'Case Approved')}
                    </h2>
                    <p className="text-sm text-emerald-300/70">
                      All {scenario.criteriaResults.length} criteria satisfied · {isInitialPa ? 'Prior authorization request ready to file' : 'Prior authorization appeal recommended'}
                    </p>
                  </div>
                </div>
    
                {/* Completed pipeline trail — only shown when pipeline was run this session */}
                {stepIdx === pipelineSteps.length - 1 && (
                  <div id="tour-pipeline-trail" className="border border-slate-700/60 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setTraceOpen(o => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-300">Pipeline Run — {pipelineSteps.length} nodes completed</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${traceOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {/* Horizontal stepper — always visible as summary */}
                    <div className="px-6 py-4 border-b border-slate-700/40 bg-slate-900/20">
                      <div className="grid grid-cols-4">
                        {pipelineSteps.map((step, i) => (
                          <div key={i} className="relative flex flex-col items-center">
                            {i < pipelineSteps.length - 1 && (
                              <div className="absolute top-5 left-1/2 w-full h-px z-0 bg-emerald-500" />
                            )}
                            <div className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 bg-emerald-500/20 border-emerald-500">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-xs font-medium mt-1.5 text-center leading-tight text-emerald-400">{step.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {traceOpen && (
                      <div className="divide-y divide-slate-700/40">
                        {pipelineSteps.map((step, i) => {
                          const trailIcons = [FileText, Search, GitBranch, Shield]
                          const TrailIcon = trailIcons[i]
                          return (
                            <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-900/20">
                              <TrailIcon className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-slate-300">{step.label}</p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{step.explanation}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
    
                <div id="tour-criteria-audit">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Extraction Audit Trail</h3>
                  <div className="space-y-3">
                    {scenario.criteriaResults.map((cr, i) => (
                      <div key={i} className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                          {cr.status === 'found'
                            ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                          <div className="flex items-center gap-2 flex-wrap">
                            <RuleTag type={cr.rule.type} />
                            <p className="text-sm text-white">{cr.rule.label}</p>
                          </div>
                        </div>
                        <div className="px-4 py-3 bg-slate-900/30 space-y-1.5">
                          {(() => {
                            const cite = scenario.citations[cr.rule.label]
                            return cite ? (
                              <>
                                <div className="flex items-start gap-3 text-xs font-mono">
                                  <span className="text-slate-600 w-28 shrink-0">source_document</span>
                                  <span className="text-slate-300">{cite.source}</span>
                                </div>
                                <div className="flex items-start gap-3 text-xs font-mono">
                                  <span className="text-slate-600 w-28 shrink-0">page_ref</span>
                                  <span className="text-slate-300">{cite.page}</span>
                                </div>
                                <div className="flex items-start gap-3 text-xs font-mono">
                                  <span className="text-slate-600 w-28 shrink-0">extracted_text</span>
                                  <span className="text-slate-400 font-sans italic leading-relaxed">&ldquo;{cite.text}&rdquo;</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">extracted_text</span>
                                <span className="text-slate-400 font-sans italic">Supporting documentation confirmed.</span>
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
    
                <div className="flex gap-3 pt-1 flex-wrap">
                  {reviewMode ? (
                    <button id="tour-review-btn" onClick={() => setPhase('review')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                      <CheckCircle className="w-4 h-4" />{isInitialPa ? 'Approve & File PA Request' : 'Approve & Submit Appeal'}
                    </button>
                  ) : (
                    <button onClick={isInitialPa ? () => openPaRequestPdf(scenario) : handleDownload}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-4 h-4" />{isInitialPa ? 'Download PA Request (PDF)' : 'Download Generated Appeal (PDF)'}
                    </button>
                  )}
                  {onSaveToPortfolio && (
                    <button onClick={onSaveToPortfolio}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
                      <Users className="w-4 h-4" />Save to Case Queue
                    </button>
                  )}
                  <button onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                    <RotateCcw className="w-4 h-4" />Reset Demo
                  </button>
                </div>
              </div>
  )
}
