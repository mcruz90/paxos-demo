import { AlertTriangle, GitBranch } from 'lucide-react'
import { InfoHint, Term } from './ui'
import { EditableRecordList } from './versioning'
import { type WorkflowPack, type WorkflowSpecData } from './workflowSpecData'

const MARKET_META: Record<string, { label: string; cls: string }> = {
  commercial: { label: 'Commercial', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  individual: { label: 'Individual', cls: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  medicare_advantage: { label: 'Medicare Adv.', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
}

export function MarketBadge({ market }: { market: string }) {
  const m = MARKET_META[market] ?? { label: market, cls: 'text-slate-400 bg-slate-500/10 border-slate-500/20' }
  return <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${m.cls}`}>{m.label}</span>
}

const escTierCls = (to: string) =>
  to.startsWith('Exception') ? 'text-red-300 bg-red-500/10 border-red-500/20'
  : to.includes('Round 2') ? 'text-violet-300 bg-violet-500/10 border-violet-500/20'
  : 'text-amber-300 bg-amber-500/10 border-amber-500/20'

const reviewTierCls: Record<string, string> = {
  Routine: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Complex: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  Exception: 'text-red-300 bg-red-500/10 border-red-500/20',
}

export function PolicyExtractionSection({
  pack, data, editing, onSetRules,
}: {
  pack: WorkflowPack; data: WorkflowSpecData; editing: boolean; onSetRules: (rules: WorkflowSpecData['rules']) => void
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-baseline gap-2"><span className="text-[10px] font-mono text-slate-600">1</span><h2 className="text-sm font-semibold text-white">From policy to rules</h2></div>
        <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
          Synthesis parses raw payer policy into typed decision rules across shared primitives; the AI Lead verifies low-confidence extractions before go-live.
        </p>
      </div>
      <div className={editing ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-3 gap-4 items-start'}>
        <div className={`${editing ? '' : 'lg:col-span-1'} bg-slate-800/40 border border-slate-700/60 rounded-xl p-4`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raw payer policy (as written)</p>
          <p className="text-xs text-slate-400 italic leading-relaxed">&ldquo;{pack.rawPolicy}&rdquo;</p>
        </div>
        <div className={editing ? '' : 'lg:col-span-2'}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
              Decision Rules
              <InfoHint text="Extracted from payer policy and verified by the AI Lead. Below 85% is flagged for operator review." wide />
            </h3>
            <span className="text-xs text-slate-500">extracted · AI-Lead verified</span>
          </div>
          {editing ? (
            <EditableRecordList
              items={data.rules as unknown as Record<string, string>[]}
              onChange={rules => onSetRules(rules as unknown as WorkflowSpecData['rules'])}
              addLabel="Add rule" blank={{ type: 'diagnostic', cond: '', crit: 'blocking' }}
              fields={[
                { key: 'type', placeholder: 'type', grow: 1, options: ['diagnostic', 'math', 'temporal', 'safety', 'provider'] },
                { key: 'cond', placeholder: 'condition', grow: 4 },
                { key: 'crit', placeholder: 'criticality', grow: 1, options: ['blocking', 'supporting'] },
              ]}
            />
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-visible">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Condition</th>
                    <th className="text-center px-4 py-3 font-medium">Criticality</th>
                    <th className="text-center px-4 py-3 font-medium">Extraction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {data.rules.map((r, i) => {
                    const flagged = r.conf !== undefined && r.conf < 0.85
                    return (
                      <tr key={i} className={`transition-colors ${flagged ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-700/20'}`}>
                        <td className="px-4 py-3"><Term term={r.type} wide><span className="font-mono text-slate-300 border-b border-dotted border-slate-600">{r.type}</span></Term></td>
                        <td className="px-4 py-3 text-slate-300">{r.cond}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.crit === 'blocking' ? 'text-red-300 bg-red-500/10 border-red-500/20' : 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>{r.crit}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.conf === undefined ? <span className="text-slate-600">—</span>
                            : flagged ? <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="w-3 h-3" />{Math.round(r.conf * 100)}% · review</span>
                            : <span className="font-mono text-slate-400">{Math.round(r.conf * 100)}%</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function CaseHandlingSection({
  data, editing, onPatch,
}: {
  data: WorkflowSpecData; editing: boolean; onPatch: (patch: Partial<WorkflowSpecData>) => void
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-baseline gap-2"><span className="text-[10px] font-mono text-slate-600">2</span><h2 className="text-sm font-semibold text-white">Case handling</h2></div>
        <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">Branch conditions, escalation triggers, and human sign-off depth — versioned and eval-gated.</p>
      </div>
      <div className={editing ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-4 items-start'}>
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Edge Cases</h3>
          {editing ? (
            <EditableRecordList items={data.edgeCases} onChange={edgeCases => onPatch({ edgeCases })} addLabel="Add edge case" blank={{ c: '', h: '' }} fields={[{ key: 'c', placeholder: 'condition', grow: 2 }, { key: 'h', placeholder: 'handling', grow: 3 }]} />
          ) : (
            <div className="space-y-2">
              {data.edgeCases.map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div><p className="text-xs font-medium text-slate-200">{e.c}</p><p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.h}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Escalation Paths</h3>
          {editing ? (
            <EditableRecordList items={data.escalations} onChange={escalations => onPatch({ escalations })} addLabel="Add escalation" blank={{ trig: '', to: 'Complex' }} fields={[{ key: 'trig', placeholder: 'trigger', grow: 3 }, { key: 'to', placeholder: 'tier', grow: 2 }]} />
          ) : (
            <div className="space-y-2">
              {data.escalations.map((e, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-300 flex-1">{e.trig}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${escTierCls(e.to)}`}>{e.to}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Human-Review Steps</h3>
          {editing ? (
            <EditableRecordList items={data.reviewSteps} onChange={reviewSteps => onPatch({ reviewSteps })} addLabel="Add review step" blank={{ tier: '', d: '' }} fields={[{ key: 'tier', placeholder: 'tier', grow: 1 }, { key: 'd', placeholder: 'reviewer + action', grow: 3 }]} />
          ) : (
            <div className="space-y-2">
              {data.reviewSteps.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${reviewTierCls[h.tier] ?? 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>{h.tier}</span>
                  <p className="text-xs text-slate-300 flex-1 leading-relaxed">{h.d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 px-4 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg">
        <p className="text-xs text-slate-500 leading-relaxed"><span className="text-slate-300 font-medium">Invariant:</span> nothing transmits to the payer until a human approves — at every tier.</p>
      </div>
    </section>
  )
}
