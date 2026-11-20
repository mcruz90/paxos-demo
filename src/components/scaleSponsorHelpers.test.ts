import { describe, expect, it } from 'vitest'
import { getSamplePayloadPreview } from './onboardingData'
import { computeSponsorFunnel, SPONSOR_BRANDS } from './sponsorData'

describe('getSamplePayloadPreview', () => {
  it('returns raw-to-canonical normalization previews for all three onboarding client archetypes', () => {
    for (const id of ['acme-digital', 'beacon-hub', 'meridian-health']) {
      const preview = getSamplePayloadPreview(id)
      expect(preview.rawFormat.length).toBeGreaterThan(3)
      expect(preview.rawSnippet.length).toBeGreaterThan(20)
      expect(Object.keys(preview.normalizedJson).length).toBeGreaterThanOrEqual(4)
      expect(preview.deidTokenPreview).toContain('Date Shift: -42d')
    }
  })

  it('produces specialty-preserving tokens specific to each client template', () => {
    expect(getSamplePayloadPreview('beacon-hub').deidTokenPreview).toContain('{{HEPATOLOGIST_NAME_1}}')
    expect(getSamplePayloadPreview('acme-digital').deidTokenPreview).toContain('{{ENDOCRINOLOGIST_NAME_1}}')
  })
})

describe('SPONSOR_BRANDS and computeSponsorFunnel', () => {
  it('covers all four specialty brands with zero-PHI k-anonymity guard metadata', () => {
    expect(SPONSOR_BRANDS.map(b => b.id)).toEqual([
      'gilead-livdelzi',
      'novo-ozempic',
      'humira-cigna',
      'pediatric-esomeprazole',
    ])
    for (const brand of SPONSOR_BRANDS) {
      const funnel = computeSponsorFunnel(brand)
      expect(funnel.initialSubmitted).toBe(brand.casesQuarter)
      expect(funnel.firstPassApprovedPct).toBeGreaterThan(0)
      expect(funnel.netAccessPct).toBe(brand.approvalRate)
      expect(funnel.netAccessPct).toBeGreaterThan(funnel.firstPassApprovedPct)
      expect(funnel.kAnonymityFloor).toBeGreaterThanOrEqual(10)
      expect(funnel.phiIdentifiersCount).toBe(0)
      expect(funnel.illustrative).toBe(true)
    }
  })
})
