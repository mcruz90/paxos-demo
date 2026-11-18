import { scenarios } from '../data/scenarios'
import { ARTIFACT_ACTOR, diffList, type VersionEntry } from './versioning'

export interface PolicyPack {
  pack: string
  drug: string
  carrier: string
  category: string
  status: string
}

export interface PackRegistryData {
  packs: PolicyPack[]
}

export const PACK_REGISTRY_V1: PackRegistryData = {
  packs: Array.from(
    new Map(
      Object.values(scenarios).map(s => [
        s.configFile,
        {
          pack: s.configFile,
          drug: s.drug.split(' ')[0],
          carrier: s.plan,
          category: s.categoryLabel,
          status: 'active',
        },
      ]),
    ).values(),
  ),
}

export const PACK_REGISTRY_HISTORY: VersionEntry<PackRegistryData>[] = [
  { version: 1, actor: ARTIFACT_ACTOR, timestamp: 'Jun 6, 2026', note: 'Initial policy-pack registry', deltas: ['Initial version'], snapshot: PACK_REGISTRY_V1 },
]

export function computePackDeltas(prev: PackRegistryData, next: PackRegistryData): string[] {
  const d = diffList(prev.packs, next.packs, 'pack', p => `${p.pack} (${p.status})`)
  return d.length ? d : ['No changes']
}

export interface PackDrift {
  pack: string
  detected: string
  source: string
  summary: string
  affectedDeployments: number
  action: string
}

export const PACK_DRIFT: PackDrift[] = [
  {
    pack: 'esomeprazole_uhc_pediatric.json',
    detected: 'Jun 16, 2026',
    source: 'NASPGHAN/ESPGHAN pediatric GERD dosing guidance revision',
    summary: 'The pediatric esomeprazole dosing range this pack encodes was superseded by an updated guideline. Packs citing the prior version are flagged until re-validated against current guidance.',
    affectedDeployments: 14,
    action: 'Affected deployments paused · re-validation queued against the eval suite',
  },
]

export const PACK_PROVENANCE: Record<string, { channel: string; version: string; status: 'resolved' | 'synthesized'; detail: string }> = {
  'ozempic_cigna_base.json': { channel: 'Pharmacy', version: 'v3', status: 'resolved', detail: 'reused across 214 cases' },
  'esomeprazole_uhc_pediatric.json': { channel: 'Pharmacy', version: 'v2', status: 'resolved', detail: 'reused across 38 cases' },
  'livdelzi_cigna_hepatology.json': { channel: 'Pharmacy', version: 'v1', status: 'synthesized', detail: 'synthesized on demand · Jun 9, 2026' },
}
