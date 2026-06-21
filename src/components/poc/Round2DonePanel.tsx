import { FileText, CheckCircle, Shield, RotateCcw, BookmarkPlus, Stethoscope } from 'lucide-react'
import { usePoc } from './PocContext'

export function Round2DonePanel() {
  const { scenario, onReset, setPhase, hoveredCite, setHoveredCite } = usePoc()
  return (
              <div className="space-y-4">
                <div className="flex gap-6 items-start">
                  {/* Left col: header + letter */}
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-violet-950/40 border border-violet-500/30 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-violet-400" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-violet-300">Round 2 Counter-Argument Ready</h2>
                        <p className="text-xs text-violet-300/70">Dose threshold · NASPGHAN 2018 · PMID {scenario.round2Appeal?.guidelinePMID}</p>
                      </div>
                    </div>
                    {/* Round 2 letter — structured sections so each maps to a citation */}
                    {scenario.round2Appeal && scenario.payerCounterOffer && (() => {
                      const r2 = scenario.round2Appeal!
                      const offer = scenario.payerCounterOffer!
                      const sectionCls = (idx: number) =>
                        `p-3 rounded-lg border transition-colors cursor-default ${
                          hoveredCite === idx
                            ? 'bg-violet-900/40 border-violet-500/50'
                            : 'bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-700/40'
                        }`
                      return (
                        <div id="tour-round2-letter" className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 font-mono text-xs text-slate-300 space-y-1 leading-relaxed">
                          <p>Dear Medical Director,</p>
                          <p className="pb-2">Thank you for your partial authorization dated <span className="text-slate-200">{offer.date}</span> for <span className="text-slate-200">{scenario.drug}</span>. We write to formally contest the approved dose limitation of <span className="text-amber-300">{offer.approvedDose}</span>.</p>
    
                          <div
                            onMouseEnter={() => setHoveredCite(0)}
                            onMouseLeave={() => setHoveredCite(null)}
                            className={sectionCls(0)}
                          >
                            <p className="font-bold text-slate-200 mb-1">CLINICAL BASIS FOR DOSE INCREASE</p>
                            <p>{r2.keyArgument}</p>
                          </div>
    
                          <div
                            onMouseEnter={() => setHoveredCite(1)}
                            onMouseLeave={() => setHoveredCite(null)}
                            className={sectionCls(1)}
                          >
                            <p className="font-bold text-slate-200 mb-1">SUPPORTING GUIDELINE</p>
                            <p>{r2.guidelineRef}</p>
                            <p className="text-slate-400">PubMed PMID: {r2.guidelinePMID}</p>
                          </div>
    
                          <div
                            onMouseEnter={() => setHoveredCite(2)}
                            onMouseLeave={() => setHoveredCite(null)}
                            className={sectionCls(2)}
                          >
                            <p className="font-bold text-slate-200 mb-1">REQUESTED AUTHORIZATION</p>
                            <p>We respectfully request authorization be revised to <span className="text-emerald-300">{r2.requiredDose}</span> for {scenario.diagnosis}. Approval at the sub-therapeutic dose previously authorized does not meet the evidence-based standard of care and places the patient at continued clinical risk.</p>
                          </div>
    
                          <div className="pt-2">
                            <p>We are prepared to provide any additional clinical documentation upon request and appreciate your prompt reconsideration.</p>
                            <p className="pt-2">Sincerely,<br />ClearAuth<br /><span className="text-slate-500">AI-Assisted Prior Authorization Team</span></p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
    
                  {/* Right col: citation panel */}
                  {scenario.round2Appeal && (
                    <div id="tour-round2-citations" className="w-72 shrink-0 sticky top-4">
                      <div className="bg-slate-800/40 border border-violet-700/40 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-violet-700/40 bg-violet-950/30">
                          <div className="flex items-center gap-2 mb-0.5">
                            <BookmarkPlus className="w-4 h-4 text-violet-400 shrink-0" />
                            <p className="text-sm font-semibold text-slate-200">Citation Ground Truth</p>
                          </div>
                          <p className="text-xs text-slate-500">Sources cited in this counter-argument</p>
                        </div>
                        <div className="divide-y divide-slate-700/40">
                          {[
                            {
                              idx: 0,
                              label: 'Clinical Guideline',
                              title: scenario.round2Appeal.guidelineRef,
                              meta: `PubMed PMID: ${scenario.round2Appeal.guidelinePMID}`,
                              quote: `Therapeutic dose for infantile GERD: ${scenario.round2Appeal.requiredDose} — below which clinical response is sub-therapeutic.`,
                            },
                            {
                              idx: 1,
                              label: 'FDA Safety Communication',
                              title: 'Ranitidine (Zantac) Market Withdrawal — NDMA Contamination',
                              meta: 'FDA · April 2020',
                              quote: 'All ranitidine products withdrawn from US market due to unacceptable NDMA levels — H2 blocker alternative unavailable.',
                            },
                            {
                              idx: 2,
                              label: 'Payer Counter-Offer on File',
                              title: `Approved ${scenario.payerCounterOffer?.approvedDose} → requested ${scenario.round2Appeal.requiredDose}`,
                              meta: `Counter-offer dated ${scenario.payerCounterOffer?.date}`,
                              quote: scenario.round2Appeal.keyArgument,
                            },
                          ].map(({ idx, label, title, meta, quote }) => {
                            const active = hoveredCite === idx
                            return (
                              <div
                                key={idx}
                                onMouseEnter={() => setHoveredCite(idx)}
                                onMouseLeave={() => setHoveredCite(null)}
                                className={`px-4 py-3 space-y-1.5 transition-colors cursor-default ${active ? 'bg-violet-950/50' : ''}`}
                              >
                                <p className={`text-xs font-semibold transition-colors ${active ? 'text-violet-200' : 'text-violet-300'}`}>{label}</p>
                                <p className={`text-xs font-medium leading-snug transition-colors ${active ? 'text-white' : 'text-slate-300'}`}>{title}</p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                  <FileText className="w-3 h-3 shrink-0" />
                                  <span>{meta}</span>
                                </div>
                                <p className={`text-xs italic text-violet-300/80 rounded px-2.5 py-1.5 leading-relaxed transition-all ${
                                  active ? 'bg-violet-950/80 border border-violet-400/50' : 'bg-violet-950/40 border border-violet-500/20'
                                }`}>
                                  {quote}
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
    
                <div className="flex items-start gap-3 px-4 py-3 bg-violet-950/20 border border-violet-500/25 rounded-xl">
                  <Stethoscope className="w-4 h-4 text-violet-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed"><span className="text-violet-200 font-medium">Clinical co-sign required</span> — this is a complex (Round 2) case, so a clinical reviewer (PharmD/MD) co-signs the argument before the coordinator files. Both sign-offs are recorded in the audit log.</p>
                </div>

                <div id="tour-round2-submit" className="flex gap-3">
                  <button onClick={() => setPhase('round2_submitted')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors">
                    <CheckCircle className="w-4 h-4" />Submit Round 2 Counter
                  </button>
                  <button onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                    <RotateCcw className="w-4 h-4" />Reset
                  </button>
                </div>
              </div>
  )
}
