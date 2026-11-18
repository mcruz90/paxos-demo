import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { resolveRegulatoryClock } from './regulatoryClocks'

describe('resolveRegulatoryClock', () => {
  it('applies CMS-0057-F authority to device/medical targets instead of outpatient Rx rules', () => {
    const deviceClient = {
      ...initialClients[0],
      paTargetType: 'device' as const,
      urgency: 'today' as const,
    }
    expect(resolveRegulatoryClock(deviceClient, scenarios['novo-ozempic-initial'])).toEqual({
      authority: 'CMS-0057-F Medical',
      windowLabel: '72h Expedited',
    })

    expect(resolveRegulatoryClock({ ...deviceClient, urgency: 'soon' }, scenarios['novo-ozempic-initial'])).toEqual({
      authority: 'CMS-0057-F Medical',
      windowLabel: '7d Standard',
    })
  })

  it('applies 42 CFR 423.568 / Commercial Rx authority to outpatient initial medication PAs', () => {
    const initClient = initialClients.find(c => c.scenarioId === 'novo-ozempic-docgap')!
    const clock = resolveRegulatoryClock(initClient, scenarios['novo-ozempic-docgap'])
    expect(clock.authority).toBe('42 CFR 423.568 / Commercial Rx')
    expect(clock.windowLabel).toBe('72h Standard Rx')

    const urgentClock = resolveRegulatoryClock({ ...initClient, urgency: 'today' }, scenarios['novo-ozempic-docgap'])
    expect(urgentClock.windowLabel).toBe('24–72h Expedited Rx')
  })

  it('applies 45 CFR 147.136 / Part D Appeal authority to appeal and payer-response cases', () => {
    const livdelziClient = initialClients.find(c => c.scenarioId === 'gilead-livdelzi')!
    expect(resolveRegulatoryClock(livdelziClient, scenarios['gilead-livdelzi'])).toEqual({
      authority: '45 CFR 147.136 / Part D Appeal',
      windowLabel: '72h Expedited Appeal',
    })

    const riveraClient = initialClients.find(c => c.scenarioId === 'pediatric-esomeprazole')!
    expect(resolveRegulatoryClock(riveraClient, scenarios['pediatric-esomeprazole'])).toEqual({
      authority: '45 CFR 147.136 / Part D Appeal',
      windowLabel: '60–180d Filing Window',
    })
  })
})
