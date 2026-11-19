import { getCaseStage } from '../../data/scenarios'
import { type Client, type ScenarioConfig } from '../../types'

export interface RegulatoryClockInfo {
  authority: string
  windowLabel: string
  citation?: string
  determined: boolean
}

// Single-rule source-verified decision clock lookup aligned with clearauth-eval's
// data/clock_registry.json (decision 0048, Proposed). Only rules verified at the
// regulatory source for the exact program/urgency/stage match; commercial PPO and
// unverified combinations return "Clock not determined" rather than guessing.
export function resolveRegulatoryClock(
  client: Client,
  scenario?: ScenarioConfig,
): RegulatoryClockInfo {
  const isMedical = client.paTargetType === 'device' || client.paTargetType === 'procedure'
  if (isMedical) {
    return {
      authority: 'Clock not determined',
      windowLabel: 'Plan type required',
      determined: false,
    }
  }

  const isAppeal =
    scenario?.lifecycle === 'appeal' ||
    client.status === 'payer_response' ||
    getCaseStage(client) === 'Appeal'

  const planName = `${scenario?.plan ?? ''} ${client.payer ?? ''}`
  const isPartD = /\bpart\s*d\b/i.test(planName)

  if (isPartD && !isAppeal && client.urgency !== 'today') {
    return {
      authority: '42 CFR 423.568(b)',
      windowLabel: '72h Standard (Part D Exception)',
      citation: '42 CFR 423.568(b)',
      determined: true,
    }
  }

  return {
    authority: 'Clock not determined',
    windowLabel: 'Benefit / plan rule unverified',
    determined: false,
  }
}
