import { useState } from 'react'
import { Plus, Clock, CheckCircle, Loader2, Zap, AlertTriangle, Shield, RotateCcw, Info, Pencil, Rocket, Beaker } from 'lucide-react'
import { truncateDelta } from './instructions'

export const ARTIFACT_ACTOR = 'M. Cruz'
export const ARTIFACT_TODAY = 'Jun 12, 2026'
export interface VersionMeta { version: number; actor: string; timestamp: string; note: string; deltas: string[] }
export interface VersionEntry<T> extends VersionMeta { snapshot: T }

export function cloneDeep<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }

export function diffList<T>(prev: T[], next: T[], label: string, fmt: (x: T) => string): string[] {
  const ps = new Set(prev.map(x => JSON.stringify(x)))
  const ns = new Set(next.map(x => JSON.stringify(x)))
  const out: string[] = []
  for (const x of next) if (!ps.has(JSON.stringify(x))) out.push(`+ ${label}: "${truncateDelta(fmt(x))}"`)
  for (const x of prev) if (!ns.has(JSON.stringify(x))) out.push(`– ${label}: "${truncateDelta(fmt(x))}"`)
  return out
}

// Regression-testing model: changes run in a sandbox against the full eval suite vs. the prod baseline
export interface DimResult { dim: string; base: number; candidate: number; threshold: number; lowerIsBetter: boolean }
export interface Experiment { id: string; timestamp: string; note: string; verdict: 'promoted' | 'blocked' | 'discarded'; results: DimResult[] }

export const PROD_BASELINE: DimResult[] = [
  { dim: 'Safety Gate',              base: 100, candidate: 100, threshold: 100, lowerIsBetter: false },
  { dim: 'Letter Structure',         base: 100, candidate: 100, threshold: 100, lowerIsBetter: false },
  { dim: 'Guideline Coverage',       base: 94,  candidate: 94,  threshold: 90,  lowerIsBetter: false },
  { dim: 'Claim-Citation Alignment', base: 97,  candidate: 97,  threshold: 95,  lowerIsBetter: false },
  { dim: 'Over-Caution Rate',        base: 4,   candidate: 4,   threshold: 5,   lowerIsBetter: true },
]

// The candidate the current edit produces in the sandbox: targeted metric improves, everything else holds.
export function cleanCandidate(): DimResult[] {
  return PROD_BASELINE.map(d => d.dim === 'Over-Caution Rate' ? { ...d, candidate: 2 } : { ...d, candidate: d.base })
}
export function dimStatus(d: DimResult): 'improved' | 'held' | 'regressed' {
  if (d.candidate === d.base) return 'held'
  return (d.lowerIsBetter ? d.candidate < d.base : d.candidate > d.base) ? 'improved' : 'regressed'
}
export function dimFails(d: DimResult): boolean {
  return d.lowerIsBetter ? d.candidate > d.threshold : d.candidate < d.threshold
}
export function verdictOf(results: DimResult[]): 'clean' | 'blocked' {
  return results.some(d => dimFails(d)) ? 'blocked' : 'clean'
}
export function thresholdLabel(n: number): string {
  return n === 1 ? '100%' : `≥ ${Math.round(n * 100)}%`
}

// Staged promotion — a clean sandbox pass earns a canary, not the whole fleet.
export const ROLLOUT_STAGES = [
  { pct: '5%',   label: 'Canary',     note: 'shadow + live on a 5% slice · auto-rollback armed' },
  { pct: '25%',  label: 'Staged',     note: 'expanded to 25% · live prod metrics within tolerance' },
  { pct: '100%', label: 'Full fleet', note: 'promoted to all deployments · regression case pinned' },
]

// A seeded, illustrative experiment that was BLOCKED — an aggressive over-caution relaxation that degraded citation quality.
export const BLOCKED_EXPERIMENT: Experiment = {
  id: 'exp-03', timestamp: 'Jun 10, 2026', note: 'Aggressively relax over-caution (infer freely)', verdict: 'blocked',
  results: [
    { dim: 'Safety Gate',              base: 100, candidate: 100, threshold: 100, lowerIsBetter: false },
    { dim: 'Letter Structure',         base: 100, candidate: 100, threshold: 100, lowerIsBetter: false },
    { dim: 'Guideline Coverage',       base: 94,  candidate: 93,  threshold: 90,  lowerIsBetter: false },
    { dim: 'Claim-Citation Alignment', base: 97,  candidate: 91,  threshold: 95,  lowerIsBetter: false },
    { dim: 'Over-Caution Rate',        base: 4,   candidate: 1,   threshold: 5,   lowerIsBetter: true },
  ],
}

export function useVersioned<T>(initial: VersionEntry<T>[], initialExperiments: Experiment[] = []) {
  const [versions, setVersions] = useState<VersionEntry<T>[]>(initial)
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<T | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [justPublished, setJustPublished] = useState<number | null>(null)
  const latest = versions[versions.length - 1]
  const current = latest.snapshot
  const nextExpId = () => `exp-${String(experiments.length + 1).padStart(2, '0')}`
  const startEdit = () => { setDraft(cloneDeep(current)); setEditing(true); setChangeNote(''); setJustPublished(null); setShowHistory(false) }
  const cancelEdit = () => { setEditing(false); setDraft(null) }
  const promote = (deltas: string[], results: DimResult[]) => {
    if (!draft || !changeNote.trim()) return
    const snap = draft, note = changeNote.trim()
    setVersions(v => [...v, { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note, deltas, snapshot: snap }])
    setExperiments(e => [...e, { id: nextExpId(), timestamp: ARTIFACT_TODAY, note, verdict: 'promoted', results }])
    setEditing(false); setDraft(null); setJustPublished(latest.version + 1)
  }
  const discardExperiment = (results: DimResult[] | null) => {
    if (results) setExperiments(e => [...e, { id: nextExpId(), timestamp: ARTIFACT_TODAY, note: changeNote.trim() || '(no note)', verdict: 'discarded', results }])
    setEditing(false); setDraft(null)
  }
  const revertTo = (v: number, deltaFn: (prev: T, next: T) => string[]) => {
    const snap = versions.find(x => x.version === v)!.snapshot
    const deltas = deltaFn(current, snap)
    if (!deltas.length || deltas[0] === 'No changes') return
    setVersions(vs => [...vs, { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note: `Reverted to v${v}`, deltas, snapshot: cloneDeep(snap) }])
    setJustPublished(latest.version + 1)
  }
  return { versions, experiments, editing, draft, setDraft, changeNote, setChangeNote, showHistory, setShowHistory, justPublished, latest, current, startEdit, cancelEdit, promote, discardExperiment, revertTo }
}

export function ArtifactControls({ version, editing, onToggleHistory, onEdit }: { version: number; editing: boolean; onToggleHistory: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-mono px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" title="Live production version">prod v{version}</span>
      <button onClick={onToggleHistory} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition-colors"><Clock className="w-3 h-3" />History</button>
      {!editing && <button onClick={onEdit} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-white transition-colors"><Pencil className="w-3 h-3" />Edit</button>}
    </div>
  )
}

export function JustPublishedBanner({ version, scope }: { version: number; scope: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="text-xs text-emerald-300">Promoted to production as <span className="font-mono">v{version}</span> · cleared the full-suite regression check in sandbox. {scope}</span>
    </div>
  )
}

export function RegressionTable({ results }: { results: DimResult[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700/50 text-slate-500 uppercase tracking-wide">
            <th className="text-left px-3 py-2 font-medium">Dimension</th>
            <th className="text-center px-3 py-2 font-medium">Prod</th>
            <th className="text-center px-3 py-2 font-medium">Sandbox</th>
            <th className="text-center px-3 py-2 font-medium">Δ</th>
            <th className="text-right px-3 py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {results.map(d => {
            const status = dimStatus(d)
            const fails = dimFails(d)
            const delta = d.candidate - d.base
            const deltaStr = delta === 0 ? '—' : (delta > 0 ? `+${delta}` : `${delta}`)
            const label = fails ? '⚠ regressed · below threshold' : status === 'improved' ? '▲ improved' : status === 'regressed' ? '▼ within tolerance' : 'held'
            const cls = fails ? 'text-red-300' : status === 'improved' ? 'text-emerald-300' : status === 'regressed' ? 'text-amber-300' : 'text-slate-500'
            return (
              <tr key={d.dim}>
                <td className="px-3 py-2 text-slate-300">{d.dim}</td>
                <td className="px-3 py-2 text-center font-mono text-slate-400">{d.base}%</td>
                <td className={`px-3 py-2 text-center font-mono ${fails ? 'text-red-300' : 'text-slate-200'}`}>{d.candidate}%</td>
                <td className="px-3 py-2 text-center font-mono text-slate-500">{deltaStr}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${cls}`}>{label}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SandboxPromotionBar({ deltas, changeNote, setChangeNote, onPromote, onDiscard, clusterCases, aiProposed }: {
  deltas: string[]; changeNote: string; setChangeNote: (s: string) => void
  onPromote: (results: DimResult[]) => void
  onDiscard: (results: DimResult[] | null) => void
  clusterCases?: number
  aiProposed?: boolean
}) {
  const [stage, setStage] = useState<'draft' | 'evaluating' | 'report' | 'rollout'>('draft')
  const [rolloutStep, setRolloutStep] = useState(0)
  const hasChanges = deltas.length > 0 && deltas[0] !== 'No changes'
  const candidate = cleanCandidate()
  const verdict = verdictOf(candidate)
  const deploy = () => { setStage('evaluating'); setTimeout(() => setStage('report'), 1700) }
  // A clean sandbox pass does NOT promote fleet-wide — it begins a staged canary
  // rollout with live prod-metric monitoring and auto-rollback, then completes.
  const beginRollout = () => {
    setStage('rollout'); setRolloutStep(0)
    setTimeout(() => setRolloutStep(1), 1000)
    setTimeout(() => setRolloutStep(2), 2000)
    setTimeout(() => onPromote(candidate), 3100)
  }

  return (
    <div className="bg-slate-800/40 border border-violet-500/30 rounded-xl p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending changes</p>
          {hasChanges && (aiProposed
            ? <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30"><Zap className="w-3 h-3" />AI-generated</span>
            : <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/40 text-slate-400 border border-slate-600/30"><Pencil className="w-3 h-3" />Manual edit</span>)}
        </div>
        {hasChanges ? (
          <div className="font-mono text-xs space-y-1">
            {deltas.map((d, i) => <p key={i} className={d.startsWith('+') ? 'text-emerald-300' : d.startsWith('–') ? 'text-red-300' : 'text-sky-300'}>{d}</p>)}
          </div>
        ) : <p className="text-xs text-slate-500">No changes yet — edit the fields above.</p>}
      </div>

      {stage === 'draft' && (
        <>
          <div className="flex items-start gap-2 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">Changes deploy to an isolated <span className="text-slate-400">sandbox</span> first — never straight to production. The full eval suite runs there before anything can be promoted.</p>
          </div>
          <input value={changeNote} onChange={e => setChangeNote(e.target.value)} placeholder="Change note (required) — e.g. why this edit is safe" className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500" />
          <div className="flex gap-3">
            <button onClick={() => onDiscard(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button onClick={deploy} disabled={!hasChanges || !changeNote.trim()} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors ml-auto"><Beaker className="w-4 h-4" />Deploy to sandbox</button>
          </div>
        </>
      )}

      {stage === 'evaluating' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Running the full eval suite in the sandbox — every dimension, not just the one you changed…</p>
          {PROD_BASELINE.map(d => (
            <div key={d.dim} className="flex items-center gap-2.5 text-xs">
              <Loader2 className="w-3 h-3 animate-spin text-slate-500 shrink-0" />
              <span className="text-slate-400 flex-1">{d.dim}</span>
            </div>
          ))}
        </div>
      )}

      {stage === 'report' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sandbox experiment · candidate vs production baseline</p>
          {clusterCases !== undefined && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-300">Cluster reproduction · <span className="font-mono text-emerald-300">{clusterCases}/{clusterCases}</span> failing cases now pass under the candidate.</span>
            </div>
          )}
          <RegressionTable results={candidate} />
          <p className="text-xs text-slate-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />{clusterCases !== undefined ? `Validated against all ${clusterCases} cluster cases AND the full regression suite — the fix resolves the cluster without degrading anything else (e.g. citation quality).` : `Regression check ran across all ${candidate.length} dimensions — confirming the targeted fix didn’t degrade anything else (e.g. citation quality).`}</p>
          {verdict === 'clean' ? (
            <div className="flex items-start gap-2 px-3 py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span className="text-xs text-emerald-300">No regressions detected — ready for a <span className="font-medium">staged rollout</span> (canary → 25% → fleet), not an instant fleet-wide flip. Live prod metrics are watched at each stage with auto-rollback armed.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" /><span className="text-xs text-red-300">Regression detected — promotion blocked. Keep iterating or discard.</span>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => onDiscard(candidate)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">Discard experiment</button>
            <button onClick={() => setStage('draft')} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">Keep iterating</button>
            <button onClick={beginRollout} disabled={verdict !== 'clean'} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors ml-auto"><Rocket className="w-4 h-4" />Promote · staged rollout</button>
          </div>
        </div>
      )}

      {stage === 'rollout' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Staged rollout · canary → fleet</p>
          <div className="space-y-2">
            {ROLLOUT_STAGES.map((s, i) => {
              const done = i < rolloutStep
              const active = i === rolloutStep
              return (
                <div key={s.pct} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${active ? 'border-emerald-500/40 bg-emerald-950/30' : done ? 'border-slate-700/50 bg-slate-900/40' : 'border-slate-800 bg-slate-900/20 opacity-50'}`}>
                  {done ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" /> : active ? <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" /> : <span className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />}
                  <span className="text-xs font-mono text-slate-200 w-12">{s.pct}</span>
                  <span className="text-xs font-medium text-slate-300 w-20">{s.label}</span>
                  <span className="text-xs text-slate-500 flex-1">{s.note}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />Each stage watches live production metrics against the sandbox baseline. A regression beyond tolerance auto-rolls-back to the previous version — no fleet-wide promotion from a single offline pass.</p>
        </div>
      )}
    </div>
  )
}

export function VersionHistoryPanel({ title, versions, latestVersion, editing, onRevert, experiments = [] }: {
  title: string; versions: VersionMeta[]; latestVersion: number; editing: boolean; onRevert: (v: number) => void; experiments?: Experiment[]
}) {
  const verdictCls: Record<Experiment['verdict'], string> = {
    promoted: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    blocked: 'text-red-300 bg-red-500/10 border-red-500/20',
    discarded: 'text-slate-400 bg-slate-700/40 border-slate-600/30',
  }
  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Production History · {title}</p>
        <div className="space-y-3">
          {[...versions].reverse().map(v => {
            const isCurrent = v.version === latestVersion
            return (
              <div key={v.version} className="flex gap-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 ${isCurrent ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                  {v.version > 1 && <div className="w-px flex-1 bg-slate-700 my-1" />}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-300">v{v.version}</span>
                    {isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">live</span>}
                    <span className="text-xs text-slate-200 font-medium">{v.note}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{v.actor} · {v.timestamp}</p>
                  <div className="font-mono text-[11px] mt-1.5 space-y-0.5">
                    {v.deltas.map((d, i) => <p key={i} className={d.startsWith('+') ? 'text-emerald-300/90' : d.startsWith('–') ? 'text-red-300/90' : d.startsWith('~') ? 'text-sky-300/90' : 'text-slate-500'}>{d}</p>)}
                  </div>
                  {!isCurrent && !editing && <button onClick={() => onRevert(v.version)} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white mt-1.5"><RotateCcw className="w-3 h-3" />Revert to v{v.version}</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700/50">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Experiment Log <span className="text-slate-600 normal-case font-normal">· sandbox runs (not all reach production)</span></p>
        {experiments.length === 0 ? (
          <p className="text-xs text-slate-600">No sandbox experiments yet.</p>
        ) : (
          <div className="space-y-2.5">
            {[...experiments].reverse().map(ex => {
              const failed = ex.results.filter(r => dimFails(r))
              return (
                <div key={ex.id} className="px-3.5 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono text-slate-400">{ex.id}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${verdictCls[ex.verdict]}`}>{ex.verdict}</span>
                    <span className="text-xs text-slate-300">{ex.note}</span>
                    <span className="text-[11px] text-slate-600 ml-auto">{ex.timestamp}</span>
                  </div>
                  {ex.verdict === 'blocked' && failed.length > 0 && (
                    <p className="text-[11px] text-red-300/90 mt-1 font-mono">
                      blocked by: {failed.map(f => `${f.dim} ${f.base}%→${f.candidate}% (min ${f.threshold}%)`).join(' · ')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function EditableRecordList<T extends Record<string, string>>({ items, fields, onChange, addLabel, blank }: {
  items: T[]
  fields: { key: keyof T & string; placeholder: string; options?: string[]; grow?: number }[]
  onChange: (items: T[]) => void
  addLabel: string
  blank: T
}) {
  const update = (i: number, key: string, val: string) => onChange(items.map((it, j) => j === i ? { ...it, [key]: val } : it))
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const add = () => onChange([...items, { ...blank }])
  const cols = fields.map(f => `${f.grow ?? 1}fr`).join(' ')
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: cols }}>
            {fields.map(f => f.options ? (
              <select key={f.key} value={it[f.key]} onChange={e => update(i, f.key, e.target.value)} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500">
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input key={f.key} value={it[f.key]} onChange={e => update(i, f.key, e.target.value)} placeholder={f.placeholder} className="bg-slate-900/60 border border-slate-700/50 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-slate-500" />
            ))}
          </div>
          <button onClick={() => remove(i)} className="w-7 h-7 rounded-lg bg-slate-700/60 hover:bg-red-500/20 hover:text-red-300 text-slate-400 flex items-center justify-center shrink-0 transition-colors" title="Delete">×</button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"><Plus className="w-3 h-3" />{addLabel}</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View — Eval Rubric (the rubric + test cases behind the Quality Report)
// ---------------------------------------------------------------------------
