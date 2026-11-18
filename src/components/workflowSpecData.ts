import { ARTIFACT_ACTOR, diffList, type VersionEntry } from './versioning'

export interface WorkflowSpecData {
  rules: { type: string; cond: string; crit: string; conf?: number }[]
  edgeCases: { c: string; h: string }[]
  escalations: { trig: string; to: string }[]
  reviewSteps: { tier: string; d: string }[]
}

export interface WorkflowPack {
  id: string
  scenarioId: string
  drug: string
  carrier: string
  file: string
  rawPolicy: string
  market: 'commercial' | 'individual' | 'medicare_advantage'
}

export const WORKFLOW_PACKS: WorkflowPack[] = [
  {
    id: 'ozempic-cigna', scenarioId: 'novo-ozempic', drug: 'Ozempic (semaglutide)', carrier: 'Cigna Connect 500 · T2DM', file: 'ozempic_cigna_base', market: 'commercial',
    rawPolicy: 'Ozempic (semaglutide) and other GLP-1 agonists are covered for confirmed type 2 diabetes mellitus in members age 18 and older. Concomitant use with another GLP-1 or GLP-1/GIP agonist is not covered. Weight-loss use (without T2DM) falls under a separate policy.',
  },
  {
    id: 'livdelzi-cigna', scenarioId: 'gilead-livdelzi', drug: 'Livdelzi (seladelpar)', carrier: 'Cigna Healthcare · PBC', file: 'livdelzi_cigna_hepatology', market: 'commercial',
    rawPolicy: 'Livdelzi (seladelpar) is covered for primary biliary cholangitis in combination with UDCA or as monotherapy for UDCA-intolerant patients when ≥2 of 3 AASLD criteria remain unmet after ≥12 months. No current or prior hepatic decompensation (absolute contraindication). Prescriber must be a hepatologist/GI.',
  },
  {
    id: 'esomeprazole-uhc', scenarioId: 'pediatric-esomeprazole', drug: 'Nexium (esomeprazole) Susp.', carrier: 'UnitedHealthcare · Pediatric GERD', file: 'esomeprazole_uhc_pediatric', market: 'commercial',
    rawPolicy: 'Nexium (esomeprazole) for suspension requires documented trial/intolerance of tablet PPIs (omeprazole, pantoprazole, rabeprazole) OR a documented swallowing limitation (oral-motor dysphagia). Claims auto-process under age 6.',
  },
  {
    id: 'humira-cigna', scenarioId: 'humira-cigna', drug: 'Humira (adalimumab)', carrier: 'Cigna Healthcare · IP0652 RA', file: 'humira_cigna_ip0652', market: 'commercial',
    rawPolicy: 'Humira (adalimumab) is non-preferred on IP0652. Coverage requires active moderate-to-severe rheumatoid arthritis (M05.79), prior DMARD trial (methotrexate ≥12 weeks), AND trial/intolerance/contraindication of preferred adalimumab biosimilar(s), plus negative TB/HBV screening.',
  },
]

export const WSPEC_OZEMPIC: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'T2DM (E11.x) confirmed — ICD code or specialist documentation required', crit: 'blocking', conf: 0.98 },
    { type: 'diagnostic', cond: 'Patient age ≥ 18 years', crit: 'blocking', conf: 0.99 },
    { type: 'safety', cond: 'NO concomitant GLP-1 or GLP-1/GIP agonist (Wegovy, Trulicity, Mounjaro, Saxenda, Zepbound)', crit: 'blocking', conf: 0.96 },
    { type: 'custom', cond: 'Indication confirmed as T2DM glycemic control — not weight loss / obesity management', crit: 'blocking', conf: 0.81 },
  ],
  edgeCases: [
    { c: 'BMI or weight-management note in chart (T2DM confirmed)', h: 'needs_review → obtain prescriber attestation that Ozempic is for T2DM glycemic control.' },
    { c: 'Patient on Rybelsus (oral semaglutide) AND requesting Ozempic injection', h: 'Safety — concomitant same-class agent; confirm discontinuation before approval.' },
    { c: 'T1DM diagnosis present in chart alongside T2DM history', h: 'Escalate to Exception — Cigna policy explicitly excludes T1DM.' },
  ],
  escalations: [
    { trig: 'Weight-management documentation without prescriber clarification', to: 'Complex' },
    { trig: 'Concomitant GLP-1 or GLP-1/GIP agonist not explicitly cleared', to: 'Exception' },
    { trig: 'Gatekeeper fails 3 retries', to: 'Exception' },
    { trig: 'Payer counter-offer received', to: 'Complex (Round 2)' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + 3 citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs the argument' },
    { tier: 'Exception', d: 'Investigate · gather docs · clinical reviewer adjudicates before filing' },
  ],
}

export const WSPEC_LIVDELZI: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'Confirmed PBC — AMA+ or biopsy AND ≥2 of 3 AASLD criteria unmet', crit: 'blocking', conf: 0.95 },
    { type: 'temporal', cond: 'UDCA ≥12 months inadequate response OR documented UDCA intolerance', crit: 'blocking', conf: 0.83 },
    { type: 'safety', cond: 'NO current or prior hepatic decompensation — absolute contraindication', crit: 'blocking', conf: 0.88 },
    { type: 'provider', cond: 'Specialist prescriber confirmed — GI / hepatologist / transplant medicine', crit: 'blocking', conf: 0.79 },
  ],
  edgeCases: [
    { c: 'Prior decompensation event (resolved)', h: 'Safety — prior decompensation is an absolute contraindication regardless of current status.' },
    { c: 'UDCA intolerance without 12-month trial', h: 'Intolerance path bypasses duration; documented adverse reaction required.' },
    { c: 'Prescriber specialty not confirmed in referral', h: 'needs_review → request hepatology/GI specialist attestation before filing.' },
  ],
  escalations: [
    { trig: 'Prior decompensation event in record', to: 'Exception' },
    { trig: 'Specialist prescriber not confirmed', to: 'Exception' },
    { trig: 'AASLD response criteria count unclear', to: 'Complex' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + key citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs' },
    { tier: 'Exception', d: 'Investigate decompensation conflict + specialist docs before filing' },
  ],
}

export const WSPEC_ESOMEPRAZOLE: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'GERD with erosive esophagitis, endoscopy-confirmed (K21.0)', crit: 'blocking', conf: 0.96 },
    { type: 'safety', cond: 'Documented oral-motor dysphagia — tablet/capsule PPIs cannot be swallowed safely', crit: 'blocking', conf: 0.9 },
    { type: 'temporal', cond: 'Tablet PPI step therapy OR documented swallowing-limitation bypass', crit: 'blocking', conf: 0.88 },
    { type: 'temporal', cond: 'Conservative therapy trial ≥ 2 weeks (dietary, positioning)', crit: 'supporting', conf: 0.86 },
  ],
  edgeCases: [
    { c: 'Suspension requested despite age ≥ 6', h: 'Step therapy applies; needs step-therapy failure or swallowing-limitation bypass.' },
    { c: 'Payer counter-offer with sub-therapeutic dose (10mg vs 20mg)', h: 'Complex Round 2 → cite Nexium label / NASPGHAN 20mg/day dosing at ≥20kg.' },
  ],
  escalations: [
    { trig: 'Step-therapy exception requested', to: 'Complex' },
    { trig: 'Payer counter-offer received', to: 'Complex (Round 2)' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm summary + key citations · 1 click' },
    { tier: 'Complex', d: 'Coordinator reviews; clinical reviewer (PharmD/MD) co-signs Round 2 dispute' },
    { tier: 'Exception', d: 'Investigate · gather docs · clinical reviewer adjudicates' },
  ],
}

export const WSPEC_HUMIRA: WorkflowSpecData = {
  rules: [
    { type: 'diagnostic', cond: 'Moderately to severely active rheumatoid arthritis (M05.79)', crit: 'blocking', conf: 0.97 },
    { type: 'temporal', cond: 'Conventional DMARD failure — methotrexate ≥12 weeks documented', crit: 'blocking', conf: 0.92 },
    { type: 'temporal', cond: 'Preferred adalimumab biosimilar trial/intolerance/contraindication (IP0652)', crit: 'blocking', conf: 0.78 },
    { type: 'safety', cond: 'Negative TB & Hepatitis B screening prior to TNF-blocker initiation', crit: 'blocking', conf: 0.95 },
  ],
  edgeCases: [
    { c: 'Prior biosimilar failed due to injection-site latex allergy or formulation intolerance', h: 'Step-therapy exception qualifies when chart cites specific biosimilar lot/reaction.' },
    { c: 'TB test > 12 months old', h: 'needs_review → request updated QuantiFERON-TB Gold before biologic renewal.' },
  ],
  escalations: [
    { trig: 'Preferred biosimilar failure not documented', to: 'Exception' },
    { trig: 'Missing baseline TB / HBV screening', to: 'Exception' },
  ],
  reviewSteps: [
    { tier: 'Routine', d: 'Confirm biosimilar step exception + TB/HBV lab citations' },
    { tier: 'Complex', d: 'Coordinator & PharmD co-sign medical-necessity argument for non-preferred brand' },
    { tier: 'Exception', d: 'Query rheumatology clinic for biosimilar failure documentation' },
  ],
}

export const WORKFLOW_HISTORY_BY_PACK: Record<string, VersionEntry<WorkflowSpecData>[]> = {
  'ozempic-cigna': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial spec from Cigna policy', deltas: ['Initial version'], snapshot: WSPEC_OZEMPIC }],
  'livdelzi-cigna': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 26, 2026', note: 'Initial spec from Cigna Livdelzi PA policy (cnf_877)', deltas: ['Initial version'], snapshot: WSPEC_LIVDELZI }],
  'esomeprazole-uhc': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 8, 2026', note: 'Initial spec from UHC PPI step-therapy policy', deltas: ['Initial version'], snapshot: WSPEC_ESOMEPRAZOLE }],
  'humira-cigna': [{ version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 27, 2026', note: 'Initial spec from Cigna IP0652 RA policy', deltas: ['Initial version'], snapshot: WSPEC_HUMIRA }],
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
