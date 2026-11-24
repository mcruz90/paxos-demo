import { describe, expect, it } from 'vitest'
import { initialClients } from '../data/scenarios'
import { computePolicyProjection, previewQueueUnderPolicy } from './automationPolicy'

describe('computePolicyProjection', () => {
  it('computes default projection at 1-in-5 (20%) sample rate with auto-assemble enabled', () => {
    const out = computePolicyProjection(true, 20, 55)
    expect(out.autoAssembledPct).toBe(55)
    expect(out.deepReviewSampleLabel).toBe('1 in 5')
    expect(out.deepReviewPct).toBe(20)
    expect(out.fastSendPct).toBe(80)
    expect(out.hoursSavedPerCoordinator).toBe('~2.3 hrs')
    expect(out.illustrative).toBe(true)
  })

  it('increases coordinator hours saved when sampling drops to 1-in-20 (5%)', () => {
    const out = computePolicyProjection(true, 5, 55)
    expect(out.autoAssembledPct).toBe(55)
    expect(out.deepReviewSampleLabel).toBe('1 in 20')
    expect(out.deepReviewPct).toBe(5)
    expect(out.fastSendPct).toBe(95)
    expect(out.hoursSavedPerCoordinator).toBe('~2.7 hrs')
  })

  it('drops auto-assembled volume to 0% and deep-review to 100% when auto-assemble is disabled', () => {
    const out = computePolicyProjection(false, 20, 55)
    expect(out.autoAssembledPct).toBe(0)
    expect(out.deepReviewSampleLabel).toBe('Review all')
    expect(out.deepReviewPct).toBe(100)
    expect(out.fastSendPct).toBe(0)
    expect(out.hoursSavedPerCoordinator).toBe('~0.6 hrs')
  })
})

describe('previewQueueUnderPolicy', () => {
  it('maps routine cases differently based on auto-assemble and review-all sampling', () => {
    const autoPreview = previewQueueUnderPolicy(initialClients, true, 20)
    expect(autoPreview).toHaveLength(initialClients.length)

    const anita = autoPreview.find(r => r.scenarioId === 'novo-ozempic-initial')!
    expect(anita.dispositionLabel).toBe('Auto-Assembled · 1-Click Sign-Off')
    expect(anita.badgeTone).toBe('emerald')

    const diane = autoPreview.find(r => r.scenarioId === 'gilead-livdelzi')!
    expect(diane.dispositionLabel).toBe('Human Investigation Required')
    expect(diane.badgeTone).toBe('rose')

    const lucas = autoPreview.find(r => r.scenarioId === 'pediatric-esomeprazole')!
    expect(lucas.dispositionLabel).toBe('Round 2 Partial Approval Review')
    expect(lucas.badgeTone).toBe('violet')

    const holdPreview = previewQueueUnderPolicy(initialClients, false, 20)
    const heldAnita = holdPreview.find(r => r.scenarioId === 'novo-ozempic-initial')!
    expect(heldAnita.dispositionLabel).toBe('Held · Full Coordinator Audit')
    expect(heldAnita.badgeTone).toBe('amber')
  })
})
