import { useState } from 'react'
import { BookOpen, Check, Database, ExternalLink, FileSearch, Loader2, Paperclip, Search, Sparkles } from 'lucide-react'
import { type DocChatFixture, type ResolverContext } from './exceptionResolver'
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

// The resolver's left panel: a demo-simulated retrieval console over the case's
// researched golden-set evidence (guideline/PubMed hits, EHR auto-verify).
// Attaching a discovered result is delegated up — the modal owns the packet.
export function EvidenceDiscoveryConsole({
  ctx,
  selected,
  onAttach,
}: {
  ctx: ResolverContext
  selected: string[]
  onAttach: (id: 'guideline' | 'ehr') => void
}) {
  // idle → searching → results for the target that ran (published guidelines
  // vs. the patient's own EHR/registry record).
  const [console_, setConsole] = useState<'idle' | 'searching' | 'guides' | 'ehr'>('idle')

  const runSearch = (target: 'guides' | 'ehr') => {
    setConsole('searching')
    setTimeout(() => setConsole(target), 900)
  }

  return (
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
                    onClick={() => onAttach('guideline')}
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
                onClick={() => onAttach('ehr')}
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
  )
}
