import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { resolveRegulatoryClock } from './regulatoryClocks'

describe('resolveRegulatoryClock', () => {
  it('resolves verified single-rule 42 CFR 423.568(b) 72h clock only for standard Part D medication exceptions', () => {
    const baseClient = initialClients.find(c => c.scenarioId === 'novo-ozempic-docgap')!
    const partDScenario = { ...scenarios['novo-ozempic-docgap'], plan: 'Medicare Part D Formulary' }

    expect(resolveRegulatoryClock({ ...baseClient, urgency: 'soon' }, partDScenario)).toEqual({
      authority: '42 CFR 423.568(b)',
      windowLabel: '72h Standard (Part D Exception)',
      citation: '42 CFR 423.568(b)',
      determined: true,
    })

    // Part D expedited and appeals are not yet source-verified in clock_registry.json
    expect(resolveRegulatoryClock({ ...baseClient, urgency: 'today' }, partDScenario).determined).toBe(false)
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
