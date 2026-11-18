import { getCaseTier } from '../data/scenarios'
import { type CaseStatus, type CaseTier, type Client } from '../types'

export interface PolicyProjection {
  autoAssembledPct: number
  deepReviewSampleLabel: string
  deepReviewPct: number
  fastSendPct: number
  hoursSavedPerCoordinator: string
}

export interface PolicyQueuePreviewRow {
  clientId: number
  scenarioId: string
  patientName: string
  drug: string
  status: CaseStatus
  tier: CaseTier
  dispositionLabel: string
  badgeTone: 'emerald' | 'amber' | 'rose' | 'violet'
}

const SAMPLE_LABELS: Record<number, string> = {
  100: 'Review all',
  20: '1 in 5',
  10: '1 in 10',
  5: '1 in 20',
}

export function computePolicyProjection(
  autoAssemble: boolean,
  sampleRatePct: number,
  routineVolumePct = 55,
): PolicyProjection {
  if (!autoAssemble) {
    return {
      autoAssembledPct: 0,
      deepReviewSampleLabel: 'Review all',
      deepReviewPct: 100,
      fastSendPct: 0,
      hoursSavedPerCoordinator: '~0.6 hrs',
    }
  }
  const fastFraction = (100 - sampleRatePct) / 100
  const saved = 0.3 + (routineVolumePct / 100) * fastFraction * 4.55
  return {
    autoAssembledPct: routineVolumePct,
    deepReviewSampleLabel: SAMPLE_LABELS[sampleRatePct] ?? `1 in ${Math.max(1, Math.round(100 / sampleRatePct))}`,
    deepReviewPct: sampleRatePct,
    fastSendPct: 100 - sampleRatePct,
    hoursSavedPerCoordinator: `~${saved.toFixed(1)} hrs`,
  }
}

export function previewQueueUnderPolicy(
  clients: Client[],
  autoAssemble: boolean,
  sampleRatePct: number,
): PolicyQueuePreviewRow[] {
  return clients.map(c => {
    const tier = getCaseTier(c)
    let dispositionLabel = 'Auto-Assembled · 1-Click Sign-Off'
    let badgeTone: PolicyQueuePreviewRow['badgeTone'] = 'emerald'
    if (c.status === 'exception') {
      dispositionLabel = 'Human Investigation Required'
      badgeTone = 'rose'
    } else if (c.status === 'payer_response') {
      dispositionLabel = 'Round 2 Counter-Offer Review'
      badgeTone = 'violet'
    } else if (c.status === 'awaiting_documentation') {
      dispositionLabel = 'Awaiting Query · Complex Review'
      badgeTone = 'amber'
    } else if (!autoAssemble || sampleRatePct >= 100) {
      dispositionLabel = 'Held · Full Coordinator Audit'
      badgeTone = 'amber'
    } else if (c.urgency === 'today' && sampleRatePct >= 20) {
      dispositionLabel = 'Sampled for Deep Review'
      badgeTone = 'amber'
    }
    return {
      clientId: c.id,
      scenarioId: c.scenarioId,
      patientName: c.patientDisplayName ?? c.name,
      drug: c.drug,
      status: c.status,
      tier,
      dispositionLabel,
      badgeTone,
    }
  })
}
