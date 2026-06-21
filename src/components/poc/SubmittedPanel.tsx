import { CheckCircle, Zap, ChevronRight, AlertTriangle, Clock, XCircle, ArrowRight } from 'lucide-react'
import { usePoc } from './PocContext'
import { TransmissionReceipt } from './Transmission'

export function SubmittedPanel() {
  const { scenario, onReset, onStartAppeal, appealRef, payerResponseResolution, setPayerResponseResolution, handleRound2Execute } = usePoc()
  const isInitialPa = scenario.lifecycle === 'initial_pa'
  return (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                  <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-emerald-400">{isInitialPa ? 'PA Request Filed' : 'Appeal Submitted'}</h2>
                    <p className="text-sm text-emerald-300/70">
                      {isInitialPa ? <>Filed to {scenario.plan} via Da Vinci PAS · {appealRef}</> : <>Transmitted to {scenario.plan} · {appealRef}</>}
                    </p>
                  </div>
                </div>
    
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-1.5">
                  {([
                    { k: 'drug',          v: scenario.drug },
                    { k: 'plan',          v: `${scenario.plan} (${scenario.planId})` },
                    { k: 'diagnosis',     v: scenario.diagnosis },
                    { k: 'reference',     v: appealRef },
                    { k: 'submitted_by',  v: 'PA Coordinator · Paxos Health Portal' },
                    { k: 'timestamp',     v: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
                  ] as const).map(({ k, v }) => (
                    <div key={k} className="flex items-start gap-3 text-xs font-mono">
                      <span className="text-slate-600 w-28 shrink-0">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>

                <TransmissionReceipt plan={scenario.plan} lifecycle={scenario.lifecycle} />

                {/* Initial-PA determination — the payer's decision after PAS filing */}
                {scenario.paOutcome && scenario.paOutcome.decision === 'approved' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                      <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-300">Payer Determination — Approved</p>
                        <p className="text-xs text-emerald-300/70 mt-0.5 leading-relaxed">{scenario.paOutcome.note}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <Clock className="w-3.5 h-3.5" />Time to therapy
                        </div>
                        <p className="text-2xl font-bold text-emerald-400">{scenario.paOutcome.timeToTherapy}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">From filing to approval — the patient can start without delay.</p>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
                        <p className="text-xs text-slate-500 mb-1">Authorization</p>
                        <p className="text-sm font-mono text-slate-200 break-all">{scenario.paOutcome.determinationId}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Valid 12 months · returned over Da Vinci PAS.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Initial-PA denial → appeal handoff (closes the lifecycle loop) */}
                {scenario.paOutcome && scenario.paOutcome.decision === 'denied' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-5 bg-amber-950/40 border border-amber-500/30 rounded-xl">
                      <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <XCircle className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-300">Payer Determination — Denied · {scenario.paOutcome.determinationId}</p>
                        <p className="text-xs text-amber-300/70 mt-0.5 leading-relaxed">{scenario.paOutcome.note}</p>
                      </div>
                    </div>
                    {scenario.appealHandoff && onStartAppeal && (
                      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-400 leading-relaxed">
                            A denial isn't the end of the lifecycle — it's the start of the next stage. The same documented
                            evidence becomes the basis for an appeal. Paxos opens the appeal on this case under reference{' '}
                            <span className="font-mono text-slate-300">{scenario.appealHandoff.caseRef}</span> and drafts the
                            argument; the coordinator reviews and files.
                          </p>
                        </div>
                        <button
                          onClick={() => onStartAppeal(scenario.appealHandoff!.scenarioId)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          <ArrowRight className="w-4 h-4" />Start Appeal — continues as {scenario.appealHandoff.caseRef}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {scenario.payerCounterOffer && (
                  <div id="tour-payer-response" className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-violet-950/40 border border-violet-500/30 rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-violet-300">Payer Response Received · {scenario.payerCounterOffer.date}</p>
                        <p className="text-xs text-violet-300/70 mt-0.5">{scenario.payerCounterOffer.summary}</p>
                      </div>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-1.5">
                      {([
                        { k: 'approved_dose',    v: scenario.payerCounterOffer.approvedDose },
                        { k: 'new_denial_basis', v: scenario.payerCounterOffer.newDenialReason },
                        { k: 'guideline_ref',    v: scenario.round2Appeal?.guidelineRef ?? '' },
                        { k: 'pmid',             v: scenario.round2Appeal?.guidelinePMID ? `https://pubmed.ncbi.nlm.nih.gov/${scenario.round2Appeal.guidelinePMID}` : '' },
                      ] as const).filter(({ v }) => v).map(({ k, v }) => (
                        <div key={k} className="flex items-start gap-3 text-xs font-mono">
                          <span className="text-slate-600 w-28 shrink-0">{k}</span>
                          <span className="text-slate-300">{v}</span>
                        </div>
                      ))}
                    </div>
    
                    {/* AI response analysis */}
                    {scenario.payerResponseAnalysis && (
                      payerResponseResolution === 'accepted' ? (
                        <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
                          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-300">Partial Approval Accepted</p>
                            <p className="text-xs text-emerald-300/70 mt-0.5">Case marked as resolved. The authorized dose has been accepted as-is.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-amber-300">AI Flag · {scenario.payerResponseAnalysis.aiFlag}</p>
                              <p className="text-xs text-slate-400 leading-relaxed">{scenario.payerResponseAnalysis.aiRationale}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setPayerResponseResolution('accepted')}
                              className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                            >
                              {scenario.payerResponseAnalysis.ctaAccept}
                            </button>
                            <button
                              id="tour-round2-execute"
                              onClick={handleRound2Execute}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              <Zap className="w-3.5 h-3.5" />{scenario.payerResponseAnalysis.ctaDispute}
                            </button>
                          </div>
                        </div>
                      )
                    )}
    
                    {/* Fallback for scenarios without AI analysis */}
                    {!scenario.payerResponseAnalysis && (
                      <button id="tour-round2-execute" onClick={handleRound2Execute}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
                        <Zap className="w-4 h-4" />Generate Round 2 Counter-Argument
                      </button>
                    )}
                  </div>
                )}
    
                <div className="flex gap-3 pt-1">
                  <button onClick={onReset}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
                    <ChevronRight className="w-4 h-4" />Return to Case Queue
                  </button>
                </div>
              </div>
  )
}
