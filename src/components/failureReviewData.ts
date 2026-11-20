import { type EditableInstruction, INSTR_GATEKEEPER, INSTR_RETRIEVAL, INSTR_SYNTHESIS_V2 } from './instructions'

export interface FailureCluster {
  id: string
  mode: string
  failureClass: string
  count: number
  trend: 'up' | 'flat' | 'down'
  severity: 'critical' | 'high' | 'medium' | 'low'
  node: string
  rootCause: string
  proposedFix: string
  proposedDraft: EditableInstruction
  sampleCases: { id: string; drug: string; symptom: string }[]
}

export const FIX_SYNTHESIS_OVERCAUTION: EditableInstruction = INSTR_SYNTHESIS_V2
export const FIX_GATEKEEPER_SAFETY: EditableInstruction = {
  ...INSTR_GATEKEEPER,
  task: [...INSTR_GATEKEEPER.task, 'Reject any safety-critical criterion that was satisfied by inference rather than explicit evidence.'],
}
export const FIX_RETRIEVAL_GROUNDING: EditableInstruction = {
  ...INSTR_RETRIEVAL,
  guardrails: [...INSTR_RETRIEVAL.guardrails, 'On long records, cap evidence spans and re-verify each citation resolves to its cited source.'],
}
export const FIX_RETRIEVAL_CONFLICT: EditableInstruction = {
  ...INSTR_RETRIEVAL,
  guardrails: [...INSTR_RETRIEVAL.guardrails, 'When two sources make contradictory claims about the same criterion, surface both and mark the criterion conflicted — never resolve the contradiction silently.'],
}

export const FAILURE_CLUSTERS: FailureCluster[] = [
  {
    id: 'cl-safety', mode: 'Safety clearance by inference', failureClass: 'safety', count: 3, trend: 'flat', severity: 'critical', node: 'gatekeeper',
    rootCause: 'The gatekeeper does not explicitly reject a safety-critical criterion that synthesis satisfied by inference rather than explicit evidence — so a contraindication could clear on weak grounds.',
    proposedFix: 'Add a deterministic gatekeeper check: reject any safety-critical criterion not backed by explicit evidence.',
    proposedDraft: FIX_GATEKEEPER_SAFETY,
    sampleCases: [
      { id: 'PH-5567', drug: 'Livdelzi', symptom: 'Decompensation flag inferred from ambiguous chart note, not explicitly documented' },
      { id: 'PH-5571', drug: 'Ozempic', symptom: 'No concomitant GLP-1 not explicitly cleared in chart — absence inferred from incomplete med list, passed gate' },
      { id: 'PH-5588', drug: 'Livdelzi', symptom: 'Decompensation flag inferred, not explicitly documented' },
    ],
  },
  {
    id: 'cl-overcaution', mode: 'Over-cautious escalation', failureClass: 'over-caution', count: 50, trend: 'up', severity: 'high', node: 'synthesis',
    rootCause: 'Synthesis escalates any criterion whose evidence is not stated outright — it cannot treat reliably-derivable evidence (e.g. trial duration from pharmacy refill records) as satisfied, so clean cases bounce to a full human review.',
    proposedFix: 'Adopt the evidence-sufficiency policy: a supporting criterion may be satisfied by explicit statement OR well-supported inference (recording the basis); never infer a safety-critical clearance.',
    proposedDraft: FIX_SYNTHESIS_OVERCAUTION,
    sampleCases: [
      { id: 'PH-3102', drug: 'Ozempic', symptom: 'Patient age derivable from DOB in referral header, flagged needs_review' },
      { id: 'PH-3140', drug: 'Ozempic', symptom: 'T2DM diagnosis derivable from ICD code + labs in chart, flagged needs_review' },
      { id: 'PH-3199', drug: 'Mounjaro', symptom: 'Step therapy derivable from claims history, escalated' },
    ],
  },
  {
    id: 'cl-grounding', mode: 'Citation drift (long drafts)', failureClass: 'grounding', count: 1, trend: 'flat', severity: 'low', node: 'retrieval',
    rootCause: 'On long records, a claim occasionally traces only loosely to its cited source — the provenance span is too broad.',
    proposedFix: 'Tighten retrieval: cap evidence spans on long records and re-verify each citation resolves to its source.',
    proposedDraft: FIX_RETRIEVAL_GROUNDING,
    sampleCases: [
      { id: 'PH-4810', drug: 'Esomeprazole Susp.', symptom: 'Citation span covers a full page; exact line ambiguous' },
    ],
  },
  {
    id: 'cl-conflict', mode: 'Conflicting source evidence', failureClass: 'grounding', count: 4, trend: 'flat', severity: 'high', node: 'retrieval',
    rootCause: 'When two source documents make contradictory claims about the same criterion (e.g. a consult notes “no decompensation” while a discharge summary documents an ascites episode), the pipeline could take the first-found span and proceed.',
    proposedFix: 'On contradictory spans for one criterion, surface both sources and mark the criterion conflicted; route to human adjudication rather than silently selecting one.',
    proposedDraft: FIX_RETRIEVAL_CONFLICT,
    sampleCases: [
      { id: 'PH-2847', drug: 'Livdelzi', symptom: 'Consult says no decompensation; discharge summary documents ascites' },
      { id: 'PH-6012', drug: 'Humira', symptom: 'Two notes disagree on prior biologic trial duration' },
      { id: 'PH-6048', drug: 'Enbrel', symptom: 'Weight differs between intake and pharmacy record — changes dose math' },
    ],
  },
]

export const SEVERITY_RANK: Record<FailureCluster['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 }
export const SEVERITY_CLS: Record<FailureCluster['severity'], string> = {
  critical: 'text-red-300 bg-red-500/10 border-red-500/30',
  high: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  medium: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  low: 'text-slate-400 bg-slate-700/40 border-slate-600/30',
}

export function scenarioIdForSampleCase(drug: string): string | undefined {
  const d = drug.toLowerCase()
  if (d.includes('livdelzi')) return 'gilead-livdelzi'
  if (d.includes('ozempic')) return 'novo-ozempic'
  if (d.includes('esomeprazole')) return 'pediatric-esomeprazole'
  if (d.includes('humira')) return 'humira-cigna'
  return undefined
}
