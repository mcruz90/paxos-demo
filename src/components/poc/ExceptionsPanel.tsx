import { CheckCircle, Users, Zap, ChevronRight, AlertTriangle, RotateCcw, Info, Stethoscope } from 'lucide-react'
import { RuleTag } from '../ui'
import { usePoc } from './PocContext'

export function ExceptionsPanel() {
  const { onReset, onSaveToPortfolio, dispatched, pendingDispatch, overrides, pendingOverride, setPendingOverride, overrideInput, setOverrideInput, unresolvedCriteria, satisfiedCriteria, allResolved, confirmDispatch, cancelPendingDispatch, stagePendingDispatch, dispatchAll, applyOverride } = usePoc()
  return (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4 p-5 bg-amber-950/40 border border-amber-500/30 rounded-xl">
                  <div className="w-11 h-11 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-amber-400">Exception Report</h2>
                    <p className="text-sm text-amber-300/70">
                      {unresolvedCriteria.length} unresolved {unresolvedCriteria.length === 1 ? 'gap' : 'gaps'} · {satisfiedCriteria.length} criteria auto-confirmed by AI
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 px-4 py-2.5 bg-violet-950/20 border border-violet-500/25 rounded-xl">
                  <Stethoscope className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed">Exception cases carry a <span className="text-violet-200">clinical reviewer</span> — clinical judgments (severity scores, contradictions, dosing) are adjudicated by a PharmD/MD before the case is filed, not by the coordinator alone.</p>
                </div>
    
                {/* AI-confirmed criteria (collapsed) */}
                <details className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer text-sm text-slate-400 hover:text-slate-300 select-none">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Confirmed by AI — {satisfiedCriteria.length} {satisfiedCriteria.length === 1 ? 'criterion' : 'criteria'}</span>
                  </summary>
                  <div className="border-t border-slate-700/60">
                    {satisfiedCriteria.map((cr, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/30 last:border-b-0">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <div className="flex items-center gap-2">
                          <RuleTag type={cr.rule.type} />
                          <span className="text-sm text-slate-300">{cr.rule.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
    
                {/* Unresolved criteria — HITL dispatch + override */}
                <div>
                  <h3 className="text-sm font-semibold text-amber-400/80 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Unresolved — review and authorize each resolution workflow
                  </h3>
                  <div className="space-y-3">
                    {unresolvedCriteria.map((cr, i) => {
                      const isDispatched   = dispatched.includes(cr.rule.label)
                      const isPending      = pendingDispatch.includes(cr.rule.label)
                      const isOverriding   = pendingOverride === cr.rule.label
                      const overrideNote   = overrides[cr.rule.label]
                      const borderClass    = overrideNote ? 'border-blue-500/25' :
                                             isDispatched  ? 'border-emerald-500/20' :
                                             isPending     ? 'border-amber-500/40' :
                                                             'border-amber-500/20'
                      return (
                        <div key={i} className={`bg-slate-800/40 border rounded-xl overflow-hidden ${borderClass}`}>
                          {/* Card header */}
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                            {overrideNote
                              ? <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                              : isDispatched
                                ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                : <AlertTriangle className={`w-4 h-4 shrink-0 ${cr.status === 'conflict' ? 'text-red-400' : 'text-amber-400'}`} />}
                            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                              <RuleTag type={cr.rule.type} />
                              <p className="text-sm text-white">{cr.rule.label}</p>
                            </div>
                            {overrideNote && (
                              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                                COORDINATOR OVERRIDE
                              </span>
                            )}
                          </div>
    
                          {/* Card body — state-conditional */}
                          {overrideNote ? (
                            // Overridden state
                            <div className="px-4 py-3 bg-blue-950/20 space-y-1.5">
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">status</span>
                                <span className="text-blue-400 font-bold tracking-wide">SATISFIED</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">override_by</span>
                                <span className="text-slate-300">PA Coordinator</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs">
                                <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">rationale</span>
                                <span className="text-slate-300 italic leading-relaxed">{overrideNote}</span>
                              </div>
                            </div>
                          ) : isPending && cr.workflowPlan ? (
                            // Dispatch confirmation state — coordinator reviews what will fire
                            <div className="px-4 py-3 bg-amber-950/20 space-y-3">
                              <p className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                                <Info className="w-3.5 h-3.5" />Review workflow before authorizing
                              </p>
                              <div className="space-y-1.5">
                                {[
                                  { k: 'action',     v: cr.workflowPlan.action },
                                  { k: 'recipient',  v: cr.workflowPlan.recipient },
                                  { k: 'channel',    v: cr.workflowPlan.channel },
                                  { k: 'turnaround', v: cr.workflowPlan.turnaround },
                                ].map(({ k, v }) => (
                                  <div key={k} className="flex items-start gap-3 text-xs font-mono">
                                    <span className="text-slate-600 w-24 shrink-0">{k}</span>
                                    <span className="text-slate-200">{v}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-end gap-2 pt-1 border-t border-amber-500/10">
                                <button onClick={() => cancelPendingDispatch(cr.rule.label)}
                                  className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                                  Cancel
                                </button>
                                <button onClick={() => confirmDispatch(cr.rule.label)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" />Confirm &amp; Dispatch
                                </button>
                              </div>
                            </div>
                          ) : isOverriding ? (
                            // Override form state
                            <div className="px-4 py-3 bg-slate-900/50 space-y-3">
                              <div>
                                <p className="text-xs font-semibold text-slate-300">Amend AI finding — edit below to correct any inaccuracies</p>
                                <p className="text-xs text-slate-500 mt-0.5">Pre-filled with AI analysis. Change only what needs correction. Saved verbatim to audit trail.</p>
                              </div>
                              <textarea
                                value={overrideInput}
                                onChange={e => setOverrideInput(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                                rows={4}
                                autoFocus
                              />
                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setPendingOverride(null); setOverrideInput('') }}
                                  className="px-3 py-1.5 text-slate-400 hover:text-slate-300 text-xs rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
                                  Cancel
                                </button>
                                <button onClick={() => applyOverride(cr.rule.label)} disabled={!overrideInput.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors">
                                  <CheckCircle className="w-3.5 h-3.5" />Apply Override
                                </button>
                              </div>
                            </div>
                          ) : isDispatched ? (
                            // Dispatched state
                            <div className="px-4 py-3 bg-emerald-950/20 space-y-1.5">
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">status</span>
                                <span className="text-emerald-400 font-bold tracking-wide">DISPATCHED</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">awaiting</span>
                                <span className="text-slate-300">{cr.workflowPlan?.recipient ?? 'Provider response'}</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">turnaround</span>
                                <span className="text-slate-300">{cr.workflowPlan?.turnaround ?? '—'}</span>
                              </div>
                            </div>
                          ) : cr.status === 'conflict' ? (
                            // Conflict state — contradictory sources surfaced, not silently resolved
                            <div className="px-4 py-3 bg-red-950/20 space-y-1.5">
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">status</span>
                                <span className="text-red-400 font-bold tracking-wide">CONFLICT · sources disagree</span>
                              </div>
                              {cr.conflictSources?.map((cs, j) => (
                                <div key={j} className="flex items-start gap-3 text-xs">
                                  <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">{j === 0 ? 'source_a' : 'source_b'}</span>
                                  <span className="text-slate-300 leading-relaxed"><span className="font-mono text-slate-400">{cs.source}</span> — <span className="italic text-slate-400">&ldquo;{cs.claim}&rdquo;</span></span>
                                </div>
                              ))}
                              <div className="flex items-start gap-3 text-xs">
                                <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">note</span>
                                <span className="text-slate-400 italic leading-relaxed">{cr.note}</span>
                              </div>
                              {cr.suggestedAction && (
                                <div className="flex items-start gap-3 text-xs pt-2 mt-1 border-t border-slate-700/40">
                                  <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">resolution_path</span>
                                  <span className="text-slate-300 leading-relaxed">{cr.suggestedAction}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            // Default unresolved state
                            <div className="px-4 py-3 bg-slate-900/30 space-y-1.5">
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">status</span>
                                <span className="text-amber-400 font-bold tracking-wide">UNRESOLVED</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs font-mono">
                                <span className="text-slate-600 w-28 shrink-0">source_doc</span>
                                <span className="text-slate-300">{cr.docSource}</span>
                              </div>
                              <div className="flex items-start gap-3 text-xs">
                                <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">excerpt</span>
                                <span className="text-slate-400 italic leading-relaxed">{cr.note}</span>
                              </div>
                              {cr.suggestedAction && (
                                <div className="flex items-start gap-3 text-xs pt-2 mt-1 border-t border-slate-700/40">
                                  <span className="font-mono text-slate-600 w-28 shrink-0 pt-0.5">resolution_path</span>
                                  <span className="text-slate-300 leading-relaxed">{cr.suggestedAction}</span>
                                </div>
                              )}
                            </div>
                          )}
    
                          {/* Action footer — only shown in default unresolved state */}
                          {!isDispatched && !isPending && !isOverriding && !overrideNote && (
                            <div className="px-4 py-3 border-t border-slate-700/60 flex items-center justify-between gap-3">
                              <button onClick={() => { setPendingOverride(cr.rule.label); setOverrideInput(cr.note) }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600/50 rounded-lg text-xs font-medium transition-colors">
                                Override
                              </button>
                              <button onClick={() => stagePendingDispatch(cr.rule.label)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors">
                                <Zap className="w-3.5 h-3.5" />Dispatch Workflow
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
    
                {/* Bottom CTA */}
                <div className="flex gap-3 pt-1 flex-wrap">
                  {allResolved ? (
                    <button onClick={onReset}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors">
                      <ChevronRight className="w-4 h-4" />Return to Case Queue
                    </button>
                  ) : (
                    <button onClick={dispatchAll}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/20 rounded-lg text-sm font-medium transition-colors">
                      <Zap className="w-4 h-4" />Review All Remaining Workflows
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
