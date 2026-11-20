import { useState } from 'react'
import { BookOpen, Check, Database, ExternalLink, FileSearch, Loader2, Paperclip, Search, Sparkles } from 'lucide-react'
import { type DocChatFixture, type ResolverContext, type ResolverGuidelineHit } from './exceptionResolver'
import { FixtureChat } from './FixtureChat'

function DocChat({ chat }: { chat: DocChatFixture }) {
  return (
    <div className="epic-card rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800">
        <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-slate-300">Ask about this evidence</span>
      </div>
      <FixtureChat
        suggestions={chat.suggestions}
        deferralReply="Free-form document Q&A runs on the live retrieval backend (unit O6) — not available on the demo rail."
        placeholder="Ask about dosing, criteria, outcomes…"
      />
    </div>
  )
}

function GuidelineHitCard({ hit, isAttached, onAttach }: { hit: ResolverGuidelineHit; isAttached: boolean; onAttach: (id: string) => void }) {
  return (
    <div className="epic-card rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5">
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-mono font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/30 rounded px-1.5 py-0.5">
          SIMULATED · SUPPORTING GUIDELINE
        </span>
        <span className="text-[10px] font-mono font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/25 rounded px-1.5 py-0.5">
          PMID {hit.pmid} · {hit.category} ({hit.effectiveDate})
        </span>
        <span className="text-[10px] font-mono text-slate-400 border border-slate-700 rounded px-1.5 py-0.5">{hit.accessLevel}</span>
        <a href={hit.url} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-blue-300 hover:underline">
          Read full article <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-xs font-semibold text-slate-200 leading-snug mb-2">{hit.ref}</p>
      <div className="border-l-2 border-emerald-500 bg-emerald-500/10 rounded-r-md px-2.5 py-2">
        <p className="text-[9px] uppercase tracking-wider text-emerald-300 mb-1 select-none font-semibold">Case-relevant excerpt</p>
        <p className="text-xs text-slate-200 leading-relaxed">{hit.snippet}</p>
      </div>
      <button
        type="button"
        onClick={() => onAttach(hit.id)}
        disabled={isAttached}
        className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
      >
        {isAttached ? <><Check className="w-3.5 h-3.5" /> Attached to packet</> : <><Paperclip className="w-3.5 h-3.5" /> Attach excerpt</>}
      </button>
    </div>
  )
}

function GuidesResults({ ctx, selected, onAttach }: { ctx: ResolverContext; selected: string[]; onAttach: (id: string) => void }) {
  if (ctx.guidelineHits.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-6">
        <p className="text-sm text-slate-400">No supporting or conflicting guideline excerpt matched in local corpus (SIMULATED)</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Empty search results never trigger automatic resolution — send an In-Basket provider query or record clinician rationale without altering source facts.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {ctx.guidelineHits.map(hit => (
        <GuidelineHitCard key={hit.id} hit={hit} isAttached={selected.includes(hit.id)} onAttach={onAttach} />
      ))}
      {ctx.docChat && <DocChat chat={ctx.docChat} />}
    </div>
  )
}

function EhrResults({ ctx, selected, onAttach }: { ctx: ResolverContext; selected: string[]; onAttach: (id: string) => void }) {
  const conflicts = ctx.conflictSources ?? []
  if (!ctx.ehrVerify && conflicts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 py-6">
        <p className="text-sm text-slate-400">No supporting or conflicting patient records matched in local corpus (SIMULATED)</p>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Empty search results never resolve an exception automatically — send an In-Basket provider query or record clinician chart reconciliation.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {ctx.ehrVerify && (
        <div className="epic-card rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
              SIMULATED · SUPPORTING PATIENT RECORD — REQUIRES CLINICIAN ASSESSMENT
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-200 leading-snug mb-1.5">{ctx.ehrVerify.registry}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{ctx.ehrVerify.finding}</p>
          <button
            type="button"
            onClick={() => onAttach('ehr')}
            disabled={selected.includes('ehr')}
            className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
          >
            {selected.includes('ehr') ? <><Check className="w-3.5 h-3.5" /> Attached to packet</> : <><Paperclip className="w-3.5 h-3.5" /> Attach local excerpt</>}
          </button>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="epic-card-rose rounded-xl border border-red-500/35 bg-red-500/5 p-3.5 space-y-2">
          <span className="inline-block text-[10px] font-mono font-semibold text-red-300 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
            SIMULATED · CONFLICTING PATIENT RECORDS — DOES NOT AUTO-RESOLVE
          </span>
          <div className="space-y-1.5">
            {conflicts.map((cs, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 text-xs">
                <p className="font-semibold text-slate-300">{cs.source}</p>
                <p className="text-slate-200 italic mt-0.5">&ldquo;{cs.claim}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {ctx.docChat && <DocChat chat={ctx.docChat} />}
    </div>
  )
}

export function EvidenceDiscoveryConsole({ ctx, selected, onAttach }: { ctx: ResolverContext; selected: string[]; onAttach: (id: string) => void }) {
  const initialMode: 'idle' | 'guides' | 'ehr' = ctx.ehrVerify || (ctx.conflictSources && ctx.conflictSources.length > 0) ? 'ehr' : ctx.guidelineHits.length > 0 ? 'guides' : 'idle'
  const [console_, setConsole] = useState<'idle' | 'searching' | 'guides' | 'ehr'>(initialMode)

  const runSearch = (target: 'guides' | 'ehr') => {
    setConsole('searching')
    setTimeout(() => setConsole(target), 550)
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden min-h-[260px]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 bg-slate-900/40 shrink-0">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
          <FileSearch className="w-3.5 h-3.5 text-blue-400" />
          Local Evidence Corpus Lookup
          <span className="text-[10px] font-mono font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/30 rounded px-1.5 py-0.5">
            SIMULATED
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => runSearch('ehr')}
            disabled={console_ === 'searching'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors whitespace-nowrap ${
              console_ === 'ehr' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <Database className="w-3 h-3 text-emerald-400" /> Find patient records
          </button>
          <button
            type="button"
            onClick={() => runSearch('guides')}
            disabled={console_ === 'searching'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border disabled:opacity-40 transition-colors whitespace-nowrap ${
              console_ === 'guides' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-slate-900/60 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            <BookOpen className="w-3 h-3 text-blue-400" /> Published Guidelines (Local)
          </button>
        </div>
        <p className="w-full text-[11px] text-slate-400">
          Searches local corpus for supporting or conflicting evidence — empty results never auto-resolve.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {console_ === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-6">
            <Search className="w-7 h-7 text-slate-600 mb-2.5" />
            <p className="text-sm font-medium text-slate-400">Search local corpus for supporting or conflicting evidence</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-sm">Lookup surfaces matching supporting or conflicting excerpts (SIMULATED). Empty results never trigger automatic resolution.</p>
          </div>
        )}
        {console_ === 'searching' && (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mb-2.5" />
            <p className="text-xs text-slate-400">Searching local corpus for supporting or conflicting evidence…</p>
          </div>
        )}
        {console_ === 'guides' && <GuidesResults ctx={ctx} selected={selected} onAttach={onAttach} />}
        {console_ === 'ehr' && <EhrResults ctx={ctx} selected={selected} onAttach={onAttach} />}
      </div>
    </div>
  )
}
