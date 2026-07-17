import { useState } from 'react'
import { BookOpen, Check, Database, ExternalLink, FileSearch, Loader2, Paperclip, Search, Sparkles, X, Zap } from 'lucide-react'
import { type DocChatFixture, type ResolverContext, assembleJustification } from './exceptionResolver'
import { FixtureChat } from './FixtureChat'

// Q&A over the retrieved evidence, in a framed card (shared FixtureChat body).
function DocChat({ chat }: { chat: DocChatFixture }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-slate-300">Ask about this evidence</span>
      </div>
      <FixtureChat
        suggestions={chat.suggestions}
        deferralReply="Free-form document Q&A runs on the live retrieval backend (unit O6) — not available on the demo rail. Try a suggested question, or open the full article above."
        placeholder="Ask about dosing, criteria, outcomes…"
      />
    </div>
  )
}

// How the exception gets resolved: dispatch the outbound workflow (fax / EHR
// task — the case parks as awaiting documentation) or resolve in place with an
// evidence-backed justification.
export type ResolutionPath = 'workflow' | 'justify'

// Exception Resolver — the operator assembles an evidence-backed justification
// instead of free-typing one from nothing: preset options (from the AI's
// suggested resolution / outbound workflow / round-2 argument), a simulated
// evidence-discovery console (guideline/PubMed search over the case's
// researched golden-set evidence — the real /api/discovery rail is unit O6),
// and a custom rationale. Apply emits the assembled justification; the caller
// decides what it resolves (criterion override or payer dispute).
export function ExceptionResolverModal({
  ctx,
  applyLabel,
  onApply,
  onClose,
}: {
  ctx: ResolverContext
  applyLabel: string
  onApply: (justification: string, path: ResolutionPath) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string[]>(
    ctx.options.filter(o => o.preselected).map(o => o.id),
  )
  const [custom, setCustom] = useState('')
  // When the criterion has an outbound workflow, dispatching it is the obvious
  // next step — preselected so the whole flow is two clicks.
  const [path, setPath] = useState<ResolutionPath>(ctx.workflow ? 'workflow' : 'justify')
  // Discovery console: idle → searching → results for the target that ran
  // (published guidelines vs. the patient's own EHR/registry record).
  const [console_, setConsole] = useState<'idle' | 'searching' | 'guides' | 'ehr'>('idle')

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const justification = assembleJustification(ctx, selected, custom)
  const canApply = path === 'workflow' ? true : justification.length > 0

  const runSearch = (target: 'guides' | 'ehr') => {
    setConsole('searching')
    setTimeout(() => setConsole(target), 900)
  }

  // Attaching a discovered result selects its evidence option (and the
  // justify path — attached evidence is the in-place resolution).
  const attach = (id: 'guideline' | 'ehr') => {
    if (ctx.options.some(o => o.id === id) && !selected.includes(id)) {
      setSelected(prev => [...prev, id])
    }
    setPath('justify')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">{ctx.title}</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-2xl">{ctx.policyNote}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: discovery console · evidence options */}
        <div className="flex-1 flex gap-6 p-6 overflow-hidden min-h-[420px]">

          {/* Left: evidence discovery console (demo-simulated) */}
          <div className="flex-1 flex flex-col bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 shrink-0">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-sky-400" />
                Evidence Discovery Console
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => runSearch('ehr')}
                  disabled={console_ === 'searching'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
                >
                  <Database className="w-3 h-3" /> Auto-verify EHR
                </button>
                <button
                  onClick={() => runSearch('guides')}
                  disabled={console_ === 'searching'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/25 hover:bg-sky-500/20 disabled:opacity-40 transition-colors"
                >
                  <BookOpen className="w-3 h-3" /> Guidelines
                </button>
                <button
                  onClick={() => runSearch('guides')}
                  disabled={console_ === 'searching'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
                >
                  <Search className="w-3 h-3" /> PubMed
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {console_ === 'idle' && (
                <div className="h-full flex flex-col items-center justify-center text-center px-6">
                  <Search className="w-8 h-8 text-slate-700 mb-3" />
                  <p className="text-sm text-slate-500">No active retrieval</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Search clinical guidelines or PubMed to find published evidence supporting the exception.
                  </p>
                </div>
              )}
              {console_ === 'searching' && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-6 h-6 text-sky-400 animate-spin mb-3" />
                  <p className="text-xs text-slate-400">Querying secure registries…</p>
                </div>
              )}
              {console_ === 'guides' && (
                ctx.guidelineHits.length > 0 ? (
                  <div className="space-y-3">
                    {ctx.guidelineHits.map(hit => (
                      <div key={hit.pmid} className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/25 rounded px-1.5 py-0.5">
                            PMID {hit.pmid}
                          </span>
                          <a
                            href={hit.url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2"
                          >
                            Read full article <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 leading-snug mb-2">{hit.ref}</p>
                        {/* The passage the retrieval flags as case-relevant —
                            highlighted like a cited span, not a plain excerpt */}
                        <div className="border-l-2 border-emerald-500 bg-emerald-500/10 rounded-r-md px-2.5 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-emerald-300 mb-1 select-none">
                            Relevant to this case
                          </p>
                          <p className="text-xs text-slate-200 leading-relaxed">{hit.snippet}</p>
                        </div>
                        <button
                          onClick={() => attach('guideline')}
                          disabled={selected.includes('guideline')}
                          className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/30 hover:bg-sky-600/30 disabled:opacity-50 transition-colors"
                        >
                          {selected.includes('guideline')
                            ? <><Check className="w-3.5 h-3.5" /> Attached to packet</>
                            : <><Paperclip className="w-3.5 h-3.5" /> Attach to evidence packet</>}
                        </button>
                      </div>
                    ))}
                    {ctx.docChat && <DocChat chat={ctx.docChat} />}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <p className="text-sm text-slate-500">No published evidence indexed for this case</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Use the preset resolutions or provide a custom clinical justification.
                    </p>
                  </div>
                )
              )}
              {console_ === 'ehr' && (
                ctx.ehrVerify ? (
                  <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-mono font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded px-1.5 py-0.5">
                        VERIFIED IN RECORD
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 leading-snug mb-1.5">{ctx.ehrVerify.registry}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{ctx.ehrVerify.finding}</p>
                    <button
                      onClick={() => attach('ehr')}
                      disabled={selected.includes('ehr')}
                      className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-50 transition-colors"
                    >
                      {selected.includes('ehr')
                        ? <><Check className="w-3.5 h-3.5" /> Attached to packet</>
                        : <><Paperclip className="w-3.5 h-3.5" /> Attach verification to packet</>}
                    </button>
                  </div>
                  {ctx.docChat && <DocChat chat={ctx.docChat} />}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <p className="text-sm text-slate-500">No discrete EHR value can satisfy this criterion</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      This gap needs a human artifact (e.g. a prescriber attestation) — dispatch the outbound workflow instead.
                    </p>
                  </div>
                )
              )}
            </div>

            <p className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-600 shrink-0">
              Demo rail — retrieval simulated from this case&rsquo;s researched golden-set evidence.
            </p>
          </div>

          {/* Right: resolution path + evidence options + custom justification */}
          <div className="w-[400px] shrink-0 flex flex-col gap-3 overflow-y-auto">
            {ctx.workflow && (
              <button
                onClick={() => setPath('workflow')}
                className={[
                  'text-left rounded-xl border p-3.5 transition-colors',
                  path === 'workflow'
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-slate-800/30 border-slate-800 hover:border-slate-700',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={[
                    'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                    path === 'workflow' ? 'bg-amber-500 border-amber-500' : 'border-slate-600',
                  ].join(' ')}>
                    {path === 'workflow' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Dispatch outbound workflow
                  </span>
                </div>
                <div className="space-y-1 ml-6">
                  {[
                    { k: 'Action',     v: ctx.workflow.action },
                    { k: 'Recipient',  v: ctx.workflow.recipient },
                    { k: 'Channel',    v: ctx.workflow.channel },
                    { k: 'Turnaround', v: ctx.workflow.turnaround },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex text-[11px] font-mono">
                      <span className="text-slate-500 w-20 shrink-0">{k}:</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 ml-6 mt-2">
                  Case parks as awaiting documentation until the response lands.
                </p>
              </button>
            )}

            {ctx.workflow && (
              <button
                onClick={() => setPath('justify')}
                className={[
                  'text-left rounded-xl border px-3.5 py-2.5 transition-colors',
                  path === 'justify'
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-slate-800/30 border-slate-800 hover:border-slate-700',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className={[
                    'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                    path === 'justify' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600',
                  ].join(' ')}>
                    {path === 'justify' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-xs font-semibold text-emerald-300">
                    Resolve in place with evidence &amp; justification
                  </span>
                </div>
              </button>
            )}

            {/* Evidence options belong to the justify path — interacting with
                them while the dispatch path is selected switches the path. */}
            <div
              className={ctx.workflow && path !== 'justify' ? 'opacity-40 space-y-2.5' : 'space-y-2.5'}
              onClickCapture={() => { if (ctx.workflow && path !== 'justify') setPath('justify') }}
            >
            {ctx.options.map(opt => {
              const on = selected.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  onClick={() => toggle(opt.id)}
                  className={[
                    'text-left rounded-xl border p-3.5 transition-colors',
                    on
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-slate-800/30 border-slate-800 hover:border-slate-700',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={[
                      'w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-colors',
                      on ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600',
                    ].join(' ')}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-slate-200 leading-snug">{opt.title}</span>
                      <span className="block text-xs text-slate-400 leading-relaxed mt-1 line-clamp-4">{opt.detail}</span>
                    </span>
                  </div>
                </button>
              )
            })}

            <div className="rounded-xl border border-slate-800 bg-slate-800/30 p-3.5">
              <p className="text-xs font-semibold text-slate-300 mb-2">Custom clinical justification</p>
              <textarea
                value={custom}
                onChange={e => setCustom(e.target.value)}
                rows={3}
                placeholder="Add case-specific rationale (optional)…"
                className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <p className="text-xs text-slate-500">
            {path === 'workflow'
              ? 'Dispatching parks the case as awaiting documentation'
              : `${selected.length} evidence item${selected.length !== 1 ? 's' : ''} in the packet`}
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(justification, path)}
              disabled={!canApply}
              className={[
                'px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 text-white transition-colors',
                path === 'workflow' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500',
              ].join(' ')}
            >
              {path === 'workflow' && ctx.workflow ? `Dispatch to ${ctx.workflow.recipient}` : applyLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
