import { getCaseStage } from '../../data/scenarios'
import { type Client, type ScenarioConfig } from '../../types'

export interface RegulatoryClockInfo {
  authority: string
  windowLabel: string
}

// Resolves the governing statutory / regulatory decision clock by benefit type
// (medical device vs. outpatient Rx) and lifecycle stage (initial vs. appeal).
// CMS-0057-F excludes outpatient drugs; pharmacy PAs follow Part D / Commercial Rx
// and appeal filing clocks (HANDOFF_CLEARAUTH.md §5.6).
export function resolveRegulatoryClock(
  client: Client,
  scenario?: ScenarioConfig,
): RegulatoryClockInfo {
  if (client.paTargetType === 'device') {
    return {
      authority: 'CMS-0057-F Medical',
      windowLabel: client.urgency === 'today' ? '72h Expedited' : '7d Standard',
    }
  }

  const isAppeal =
    scenario?.lifecycle === 'appeal' ||
    client.status === 'payer_response' ||
    getCaseStage(client) === 'Appeal'

  if (isAppeal) {
    return {
      authority: '45 CFR 147.136 / Part D Appeal',
      windowLabel: client.urgency === 'today' ? '72h Expedited Appeal' : '60–180d Filing Window',
    }
  }

  return {
    authority: '42 CFR 423.568 / Commercial Rx',
    windowLabel: client.urgency === 'today' ? '24–72h Expedited Rx' : '72h Standard Rx',
  }
}
