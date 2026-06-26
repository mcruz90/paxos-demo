import { useState } from 'react'
import { AlertTriangle, Package, GitBranch, ArrowRight } from 'lucide-react'
import { IllustrativeTag, InfoHint, RoleChip, Term } from './ui'
import { ARTIFACT_ACTOR, ARTIFACT_TODAY, ArtifactControls, diffList, type DimResult, EditableRecordList, type Experiment, JustPublishedBanner, SandboxPromotionBar, type VersionEntry, VersionHistoryPanel } from './versioning'

export interface WorkflowSpecData {
  rules: { type: string; cond: string; crit: string; conf?: number }[]
  edgeCases: { c: string; h: string }[]
  escalations: { trig: string; to: string }[]
  reviewSteps: { tier: string; d: string }[]
}

export interface WorkflowPack { id: string; drug: string; carrier: string; file: string; rawPolicy: string }

export const WORKFLOW_PACKS: WorkflowPack[] = [
  {
    id: 'ozempic-cigna', drug: 'Ozempic (semaglutide)', carrier: 'Cigna Connect 500 · T2DM', file: 'ozempic_cigna_base',
    rawPolicy: 'Coverage for GLP-1 receptor agonists (e.g., semaglutide) for type 2 diabetes mellitus requires an established T2DM diagnosis, a recent HbA1c demonstrating inadequate glycemic control, and a trial of metformin of adequate duration and dose unless contraindicated or not tolerated. Members with a personal or family history of medullary thyroid carcinoma or MEN2 are not eligible.',
  },
  {
    id: 'livdelzi-cigna', drug: 'Livdelzi (seladelpar)', carrier: 'Cigna Healthcare · PBC', file: 'livdelzi_cigna_hepatology',
    rawPolicy: 'Livdelzi (seladelpar) is covered for primary biliary cholangitis in combination with UDCA or as monotherapy for those unable to tolerate UDCA, when ≥2 of 3 AASLD biochemical response criteria remain unmet after ≥12 months of adequate UDCA therapy. No current or prior hepatic decompensation (absolute contraindication, including history). Prescriber must be a gastroenterologist, hepatologist, or transplant specialist.',
  },
  {
    id: 'omeprazole-uhc', drug: 'Omeprazole 2mg/mL Susp.', carrier: 'UnitedHealthcare · Infant GERD', file: 'omeprazole_uhc_pediatric',
    rawPolicy: 'Compounded omeprazole oral suspension is non-formulary; formulary tablet/capsule alternatives must be tried first unless contraindicated. Coverage for infants requires documented GERD with esophagitis and a trial of conservative measures. Dosing must follow standard protocol.',
  },
]

export const WSPEC_OZEMPIC: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'T2DM (E11.x) established and documented', crit: 'blocking', conf: 0.98 },
    { type: 'math',       cond: 'HbA1c ≥ 7.5% within last 180 days', crit: 'blocking', conf: 0.82 },
    { type: 'temporal',   cond: 'Metformin ≥ 90 consecutive days at max tolerated dose', crit: 'supporting', conf: 0.94 },
    { type: 'safety',     cond: 'NO personal/family history of MTC or MEN2', crit: 'blocking', conf: 0.97 },
  ],
  edgeCases: [
    { c: 'Metformin intolerance / contraindication documented', h: 'Temporal rule bypassed — criterion satisfied via intolerance path (eGFR < 30, GI intolerance).' },
    { c: 'Trial duration derivable from refill records but not stated', h: 'Satisfied via inferred evidence basis (supporting criticality only). Cite the refill record.' },
    { c: 'HbA1c result older than 180 days', h: 'needs_review → request a current lab before proceeding.' },
    { c: 'Safety criterion (MTC/MEN2) not explicitly cleared', h: 'Never inferred. Absence must be explicitly documented or the case escalates.' },
  ],
  escalations: [
    { trig: 'Supporting criterion unsupported / contradictory', to: 'Complex' },
    { trig: 'Safety criterion not explicitly cleared', to: 'Exception' },
    { trig: 'Gatekeeper fails 3 retries', to: 'Exception' },
    { trig: 'Payer counter-offer received', to: 'Complex (Round 2)' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + 3 citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs the argument · may edit' },
    { tier: 'Exception', d: 'Investigate · gather docs · clinical reviewer adjudicates before filing' },
  ],
}

export const WSPEC_LIVDELZI: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'Confirmed PBC — AMA-positive or compatible biopsy, ≥2 of 3 AASLD criteria unmet (ALP > ULN, bili > 0.5× ULN, AST/ALT > 2.5× ULN)', crit: 'blocking', conf: 0.95 },
    { type: 'temporal',   cond: 'UDCA ≥12 months inadequate response (AASLD criteria unmet) OR documented UDCA intolerance', crit: 'blocking', conf: 0.83 },
    { type: 'safety',     cond: 'NO current or prior hepatic decompensation — absolute contraindication includes historical events', crit: 'blocking', conf: 0.88 },
    { type: 'prescriber', cond: 'Specialist prescriber confirmed — GI / hepatologist / transplant medicine', crit: 'blocking', conf: 0.79 },
  ],
  edgeCases: [
    { c: 'Prior decompensation event (resolved)', h: 'Safety — prior decompensation is an absolute contraindication per Cigna policy regardless of current status. Escalate to Exception.' },
    { c: 'UDCA intolerance without 12-month trial', h: 'Intolerance path bypasses duration; documented adverse reaction required with citation.' },
    { c: 'ALP borderline at or just above ULN', h: 'needs_review → confirm units and reference range; document lab trend with citation.' },
    { c: 'Prescriber specialty not confirmed in referral', h: 'needs_review → request specialist attestation before filing.' },
  ],
  escalations: [
    { trig: 'Prior decompensation event in record', to: 'Exception' },
    { trig: 'Specialist prescriber not confirmed', to: 'Exception' },
    { trig: 'AASLD response criteria count unclear', to: 'Complex' },
    { trig: 'Gatekeeper fails 3 retries', to: 'Exception' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + key citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs the argument · may edit' },
    { tier: 'Exception', d: 'Investigate · gather decompensation history + specialist docs · clinical reviewer adjudicates before filing' },
  ],
}

export const WSPEC_OMEPRAZOLE: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'GERD with esophagitis, endoscopy-confirmed (K21.0)', crit: 'blocking', conf: 0.96 },
    { type: 'safety',     cond: 'Age ≤ 12 months — solid oral forms contraindicated; liquid required', crit: 'blocking', conf: 0.92 },
    { type: 'temporal',   cond: 'Conservative therapy trial ≥ 2 weeks (positioning, thickened feeds)', crit: 'blocking', conf: 0.88 },
    { type: 'safety',     cond: 'Formulary H2 alternative (ranitidine) unavailable — FDA withdrawal', crit: 'supporting', conf: 0.86 },
  ],
  edgeCases: [
    { c: 'Non-formulary compounded formulation', h: 'Requires formulary-exception justification (age-based contraindication to solid forms).' },
    { c: 'Payer counter-offer with sub-therapeutic dose', h: 'Complex Round 2 → cite NASPGHAN 1 mg/kg/day dosing.' },
    { c: 'Weight-based dose derivable from chart', h: 'Supporting inference allowed; cite the weight and date.' },
    { c: 'Age verification', h: 'Safety — explicit DOB required, never inferred.' },
  ],
  escalations: [
    { trig: 'Non-formulary formulation requested', to: 'Complex' },
    { trig: 'Payer counter-offer received', to: 'Complex (Round 2)' },
    { trig: 'Authorized dose below guideline threshold', to: 'Complex' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + key citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs the argument · may edit' },
    { tier: 'Exception', d: 'Investigate · gather docs · clinical reviewer adjudicates before filing' },
  ],
}

export const WORKFLOW_HISTORY_BY_PACK: Record<string, VersionEntry<WorkflowSpecData>[]> = {
  'ozempic-cigna':  [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial spec from Cigna policy', deltas: ['Initial version'], snapshot: WSPEC_OZEMPIC }],
  'livdelzi-cigna': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 26, 2026', note: 'Initial spec from Cigna Livdelzi PA policy (cnf_877)', deltas: ['Initial version'], snapshot: WSPEC_LIVDELZI }],
  'omeprazole-uhc': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 8, 2026', note: 'Initial spec from UHC pediatric policy', deltas: ['Initial version'], snapshot: WSPEC_OMEPRAZOLE }],
}

export function computeWorkflowDeltas(prev: WorkflowSpecData, next: WorkflowSpecData): string[] {
  const d = [
    ...diffList(prev.rules, next.rules, 'rule', r => r.cond),
    ...diffList(prev.edgeCases, next.edgeCases, 'edge case', e => e.c),
    ...diffList(prev.escalations, next.escalations, 'escalation', e => e.trig),
    ...diffList(prev.reviewSteps, next.reviewSteps, 'review step', h => `${h.tier}: ${h.d}`),
  ]
  return d.length ? d : ['No changes']
}

// Color the target tier so triage reads at a glance.
const escTierCls = (to: string) =>
  to.startsWith('Exception') ? 'text-red-300 bg-red-500/10 border-red-500/20'
  : to.includes('Round 2') ? 'text-violet-300 bg-violet-500/10 border-violet-500/20'
  : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
const reviewTierCls: Record<string, string> = {
  Routine:   'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  Complex:   'text-amber-300 bg-amber-500/10 border-amber-500/20',
  Exception: 'text-red-300 bg-red-500/10 border-red-500/20',
}

export function WorkflowSpecView() {
  const [packId, setPackId] = useState('ozempic-cigna')
  const [historyById, setHistoryById] = useState<Record<string, VersionEntry<WorkflowSpecData>[]>>(WORKFLOW_HISTORY_BY_PACK)
  const [experimentsById, setExperimentsById] = useState<Record<string, Experiment[]>>({})
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<WorkflowSpecData | null>(null)
  const [changeNote, setChangeNote] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [justPublished, setJustPublished] = useState<number | null>(null)

  const pack = WORKFLOW_PACKS.find(p => p.id === packId)!
  const versions = historyById[packId]
  const experiments = experimentsById[packId] ?? []
  const latest = versions[versions.length - 1]
  const current = latest.snapshot
  const data = editing && draft ? draft : current
  const deltas = editing && draft ? computeWorkflowDeltas(current, draft) : []
  const set = (patch: Partial<WorkflowSpecData>) => setDraft(d => d ? { ...d, ...patch } : d)

  const expId = () => `exp-${String(experiments.length + 1).padStart(2, '0')}`
  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(current))); setEditing(true); setChangeNote(''); setJustPublished(null); setShowHistory(false) }
  const promote = (results: DimResult[]) => {
    if (!draft || !changeNote.trim()) return
    const note = changeNote.trim(), computed = deltas
    setHistoryById(h => ({ ...h, [packId]: [...h[packId], { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note, deltas: computed, snapshot: draft }] }))
    setExperimentsById(e => ({ ...e, [packId]: [...(e[packId] ?? []), { id: expId(), timestamp: ARTIFACT_TODAY, note, verdict: 'promoted', results }] }))
    setEditing(false); setDraft(null); setJustPublished(latest.version + 1)
  }
  const discard = (results: DimResult[] | null) => {
    if (results) setExperimentsById(e => ({ ...e, [packId]: [...(e[packId] ?? []), { id: expId(), timestamp: ARTIFACT_TODAY, note: changeNote.trim() || '(no note)', verdict: 'discarded', results }] }))
    setEditing(false); setDraft(null)
  }
  const revertTo = (v: number) => {
    const snap = versions.find(x => x.version === v)!.snapshot
    const computed = computeWorkflowDeltas(current, snap)
    if (computed[0] === 'No changes') return
    setHistoryById(h => ({ ...h, [packId]: [...h[packId], { version: latest.version + 1, actor: ARTIFACT_ACTOR, timestamp: ARTIFACT_TODAY, note: `Reverted to v${v}`, deltas: computed, snapshot: JSON.parse(JSON.stringify(snap)) }] }))
    setJustPublished(latest.version + 1)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-white">Workflow Spec</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            One spec per drug × payer policy pack. The synthesis pipeline extracts the rules from the payer policy; the AI Lead verifies and corrects them here — every change is eval-gated before it propagates.
          </p>
        </div>
        <div className="flex items-center gap-2"><RoleChip layer="build" /><IllustrativeTag /></div>
      </div>

      <div className="px-8 py-6 space-y-8">

        {/* Pack selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {WORKFLOW_PACKS.map(p => {
            const active = p.id === packId
            return (
              <button
                key={p.id}
                onClick={() => { if (!editing) setPackId(p.id) }}
                disabled={editing && !active}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Package className="w-3.5 h-3.5" />{p.drug.split(' ')[0]}
              </button>
            )
          })}
          {editing && <span className="text-xs text-slate-500 ml-1">Finish or cancel your draft to switch packs</span>}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm min-w-0">
            <span className="text-white font-medium">{pack.drug}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{pack.carrier}</span>
            <span className="text-xs font-mono text-emerald-400 ml-1">{pack.file}</span>
          </div>
          <ArtifactControls version={latest.version} editing={editing} onToggleHistory={() => setShowHistory(s => !s)} onEdit={startEdit} />
        </div>

        {justPublished !== null && !editing && <JustPublishedBanner version={justPublished} scope="The updated spec is live for this policy pack." />}

        {/* Messy → structured */}
        <div className="grid grid-cols-2 gap-4 items-stretch">
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raw payer policy (as written)</p>
            <p className="text-xs text-slate-400 italic leading-relaxed">&ldquo;{pack.rawPolicy}&rdquo;</p>
          </div>
          <div className="bg-emerald-950/15 border border-emerald-500/25 rounded-xl p-4 flex flex-col justify-center">
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">Pipeline-extracted · AI-Lead-verified</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              The synthesis pipeline parses the policy into typed decision rules, thresholds, edge-case paths, and review depths — all from the four shared primitives. The AI Lead verifies the extraction below before the pack goes live; the engine is identical across every pack.
            </p>
          </div>
        </div>

        {/* Decision rules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
              Decision Rules
              <InfoHint text="Extracted from the payer policy by the synthesis pipeline, then verified by the AI Lead. Low-confidence extractions are flagged for review — e.g. whether the policy means > or ≥. Editing reviews and corrects the extraction; changes are eval-gated before they reach any case." wide />
            </h2>
            <span className="text-xs text-slate-500">extracted · AI-Lead verified</span>
          </div>
          {editing ? (
            <EditableRecordList
              items={data.rules as unknown as Record<string, string>[]}
              onChange={rules => set({ rules: rules as unknown as WorkflowSpecData['rules'] })}
              addLabel="Add rule"
              blank={{ type: 'diagnostic', cond: '', crit: 'blocking' }}
              fields={[
                { key: 'type', placeholder: 'type', grow: 1, options: ['diagnostic', 'math', 'temporal', 'safety'] },
                { key: 'cond', placeholder: 'condition', grow: 4 },
                { key: 'crit', placeholder: 'criticality', grow: 1, options: ['blocking', 'supporting'] },
              ]}
            />
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-visible">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">Type<InfoHint text="Each rule maps to one of four shared primitives — diagnostic, temporal, math (biomarker), or safety. Hover a row’s type for what it checks." wide /></span>
                    </th>
                    <th className="text-left px-4 py-3 font-medium">Condition</th>
                    <th className="text-center px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">Criticality<InfoHint text="Blocking = must be satisfied or the request is denied. Supporting = strengthens the case and can be met by a well-supported inference. Hover a value for detail." wide /></span>
                    </th>
                    <th className="text-center px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">Extraction<InfoHint text="The synthesis pipeline's confidence that it extracted this rule and its operator correctly from the payer policy. Below 85% is flagged for AI-Lead review." wide /></span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {data.rules.map((r, i) => {
                    const flagged = r.conf !== undefined && r.conf < 0.85
                    return (
                    <tr key={i} className={`transition-colors ${flagged ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-slate-700/20'}`}>
                      <td className="px-4 py-3">
                        <Term term={r.type} wide>
                          <span className="font-mono text-slate-300 border-b border-dotted border-slate-600">{r.type}</span>
                        </Term>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.cond}</td>
                      <td className="px-4 py-3 text-center">
                        <Term term={r.crit} wide>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${r.crit === 'blocking' ? 'text-red-300 bg-red-500/10 border-red-500/20' : 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>{r.crit}</span>
                        </Term>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.conf === undefined ? <span className="text-slate-600">—</span>
                          : flagged
                            ? <span className="inline-flex items-center gap-1 text-amber-300" title="Low extraction confidence — verify this rule and its operator"><AlertTriangle className="w-3 h-3" />{Math.round(r.conf * 100)}% · review</span>
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

        {/* Edge cases */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Edge Cases</h2>
          {editing ? (
            <EditableRecordList
              items={data.edgeCases}
              onChange={edgeCases => set({ edgeCases })}
              addLabel="Add edge case"
              blank={{ c: '', h: '' }}
              fields={[{ key: 'c', placeholder: 'condition', grow: 2 }, { key: 'h', placeholder: 'handling', grow: 3 }]}
            />
          ) : (
            <div className="space-y-2">
              {data.edgeCases.map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <GitBranch className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-slate-200">{e.c}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{e.h}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Escalation paths — how a case is triaged out of the routine lane */}
        <div>
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5 mb-1">
            Escalation Paths
            <InfoHint text="The conditions that pull a case out of the routine lane into closer review. Each maps a trigger to the tier it escalates to — Complex (multi-round / judgment-heavy), Exception (a gap a human must resolve), or a Round 2 rebuttal." wide />
          </h2>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed max-w-3xl">
            How the pipeline decides a case needs more than a routine approval. These triggers and thresholds shift with payer behavior, model improvements, and regulatory changes — edit them with the spec&rsquo;s <span className="text-slate-300">Edit</span> control above; every change is eval-gated and versioned before it propagates.
          </p>
          {editing ? (
            <EditableRecordList
              items={data.escalations}
              onChange={escalations => set({ escalations })}
              addLabel="Add escalation"
              blank={{ trig: '', to: 'Complex' }}
              fields={[{ key: 'trig', placeholder: 'trigger', grow: 3 }, { key: 'to', placeholder: 'tier (Complex / Exception / Complex (Round 2))', grow: 2 }]}
            />
          ) : (
            <div className="space-y-2">
              {data.escalations.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300 flex-1">{e.trig}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${escTierCls(e.to)}`}>{e.to}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Human-review steps — who reviews at each tier, and how deeply */}
        <div>
          <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5 mb-1">
            Human-Review Steps
            <InfoHint text="What a human does at each tier before anything is filed. Depth scales with complexity — a glance-and-approve for routine, a clinical co-sign for complex/exception — never the presence of a human." wide />
          </h2>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed max-w-3xl">
            The oversight each tier gets and who provides it. Like the rest of the spec, these are edited with <span className="text-slate-300">Edit</span> above — versioned and eval-gated — and evolve as the case mix and regulations change.
          </p>
          {editing ? (
            <EditableRecordList
              items={data.reviewSteps}
              onChange={reviewSteps => set({ reviewSteps })}
              addLabel="Add review step"
              blank={{ tier: '', d: '' }}
              fields={[{ key: 'tier', placeholder: 'tier (Routine / Complex / Exception)', grow: 1 }, { key: 'd', placeholder: 'reviewer + action', grow: 3 }]}
            />
          ) : (
            <div className="space-y-2">
              {data.reviewSteps.map((h, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${reviewTierCls[h.tier] ?? 'text-slate-400 bg-slate-700/40 border-slate-600/30'}`}>{h.tier}</span>
                  <p className="text-sm text-slate-300 flex-1 leading-relaxed">{h.d}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 px-4 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="text-slate-300 font-medium">Invariant:</span> nothing transmits to the payer until a human approves — at every tier. Complex and exception cases additionally require a clinical reviewer (PharmD/MD) co-sign before filing.
            </p>
          </div>
        </div>

        {editing && (
          <SandboxPromotionBar deltas={deltas} changeNote={changeNote} setChangeNote={setChangeNote} onPromote={promote} onDiscard={discard} />
        )}

        {showHistory && (
          <VersionHistoryPanel title={`${pack.drug.split(' ')[0]} Spec`} versions={versions} latestVersion={latest.version} editing={editing} onRevert={revertTo} experiments={experiments} />
        )}

      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View — Failure-Review Loop (the implementer's debugging artifact)
// ---------------------------------------------------------------------------
