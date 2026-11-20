import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { resolveRegulatoryClock } from './regulatoryClocks'

describe('resolveRegulatoryClock', () => {
  it('resolves 42 CFR 423.568(b) 72h clock only for standard Part D exception requests with start event', () => {
    const baseClient = initialClients.find(c => c.scenarioId === 'novo-ozempic-docgap')!
    const partDScenario = { ...scenarios['novo-ozempic-docgap'], plan: 'Medicare Part D Formulary' }

    const resolved = resolveRegulatoryClock(
      { ...baseClient, urgency: 'soon', requestType: 'exception' },
      partDScenario,
    )
    expect(resolved).toEqual({
      authority: '42 CFR 423.568(b)',
      windowLabel: "72 h from the prescriber's supporting statement",
      citation: '42 CFR 423.568(b)',
      startEvent: 'supporting_statement_received',
      determined: true,
    })

    // Part D non-exception requests (even when workflow status is 'exception') must not receive the exception clock
    const coverageDet = resolveRegulatoryClock(
      { ...baseClient, status: 'exception', urgency: 'soon', requestType: 'coverage_determination' },
      partDScenario,
    )
    expect(coverageDet.determined).toBe(false)
    expect(coverageDet.authority).toBe('Clock not determined')

    const omittedReqType = resolveRegulatoryClock({ ...baseClient, status: 'exception', urgency: 'soon' }, partDScenario)
    expect(omittedReqType.determined).toBe(false)
    expect(omittedReqType.authority).toBe('Clock not determined')

    // Part D expedited and appeals are not yet source-verified in clock_registry.json
    expect(resolveRegulatoryClock({ ...baseClient, urgency: 'today', requestType: 'exception' }, partDScenario).determined).toBe(false)
    expect(resolveRegulatoryClock({ ...baseClient, urgency: 'today' }, partDScenario).authority).toBe('Clock not determined')
    expect(resolveRegulatoryClock(initialClients.find(c => c.scenarioId === 'novo-ozempic')!, { ...scenarios['novo-ozempic'], plan: 'Medicare Part D' }).determined).toBe(false)
  })

  it('returns "Clock not determined" for commercial PPO cases without mixing Part D or range labels', () => {
    for (const sid of ['novo-ozempic-docgap', 'gilead-livdelzi', 'pediatric-esomeprazole']) {
      const client = initialClients.find(c => c.scenarioId === sid)!
      const info = resolveRegulatoryClock(client, scenarios[sid])
      expect(info.determined).toBe(false)
      expect(info.authority).toBe('Clock not determined')
      expect(`${info.authority} ${info.windowLabel}`).not.toMatch(/Commercial Rx|147\.136|60–180|24–72|42 CFR/)
    }
  })

  it('returns "Clock not determined" for device/procedure targets when plan rule is unverified', () => {
    const deviceClient = {
      ...initialClients[0],
      paTargetType: 'device' as const,
      urgency: 'today' as const,
    }
    const info = resolveRegulatoryClock(deviceClient, scenarios['novo-ozempic-initial'])
    expect(info.determined).toBe(false)
    expect(info.authority).toBe('Clock not determined')
  })
})
