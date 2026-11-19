import { getCaseStage } from '../../data/scenarios'
import { type Client, type ScenarioConfig } from '../../types'

export interface RegulatoryClockInfo {
  authority: string
  windowLabel: string
  citation?: string
  startEvent?: string
  determined: boolean
}

// Single-rule source-verified decision clock lookup aligned with clearauth-eval's
// data/clock_registry.json (decision 0048, Proposed). Only matches when program,
// request_type ('exception'), urgency ('standard'), and start_event match the
// verified part_d_exception_standard row; all other cases return "Clock not determined".
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
  const isExceptionRequest = client.requestType === 'exception' || scenario?.requestType === 'exception'

  if (isPartD && isExceptionRequest && !isAppeal && client.urgency !== 'today') {
    return {
      authority: '42 CFR 423.568(b)',
      windowLabel: "72 h from the prescriber's supporting statement",
      citation: '42 CFR 423.568(b)',
      startEvent: 'supporting_statement_received',
      determined: true,
    }
  }

  return {
    authority: 'Clock not determined',
    windowLabel: 'Benefit / plan rule unverified',
    determined: false,
  }
}
