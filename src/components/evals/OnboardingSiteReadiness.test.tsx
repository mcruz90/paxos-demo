import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import { ONBOARDING_TEMPLATES } from '../onboardingData'
import { ValidateLaunchStep } from '../OnboardingValidateStep'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('OnboardingValidateStep site_readiness not_built card (G-04)', () => {
  it('replaces illustrative Setup Time estimates with site_readiness not_built across all templates', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const siteItem = snap.not_built.items.find(i => i.id === 'site_readiness')!

    for (const template of ONBOARDING_TEMPLATES) {
      const text = visibleText(
        renderToStaticMarkup(
          <ValidateLaunchStep
            template={template}
            validating={false}
            validated={true}
            launched={false}
            onRunValidation={() => {}}
            onLaunch={() => {}}
            setView={() => {}}
            snapshot={snap}
          />,
        ),
      )

      expect(text).toContain('Setup Time')
      expect(text).toContain('Not built in the harness')
      expect(text).toContain(siteItem.name)
      expect(text).toContain(siteItem.why)
      expect(text).toContain(`clearauth-eval decision ${snap.not_built.decision.number} · ${snap.not_built.decision.status}`)

      for (const forbidden of ['~45 min', '~1 hour', '~2 hours', 'configuration vs. multi-week build']) {
        expect(text).not.toContain(forbidden)
      }
    }
  })

  it('shows not in this snapshot when snapshot or site_readiness item is missing', () => {
    const nullText = visibleText(
      renderToStaticMarkup(
        <ValidateLaunchStep
          template={ONBOARDING_TEMPLATES[0]}
          validating={false}
          validated={true}
          launched={false}
          onRunValidation={() => {}}
          onLaunch={() => {}}
          setView={() => {}}
          snapshot={null}
        />,
      ),
    )
    expect(nullText).toContain(NOT_IN_SNAPSHOT)
    expect(nullText).not.toContain('~45 min')
    expect(nullText).not.toContain('~1 hour')
    expect(nullText).not.toContain('~2 hours')

    const missingSite = structuredClone(DEFAULT_EVAL_SNAPSHOT!)
    missingSite.not_built.items = missingSite.not_built.items.filter(i => i.id !== 'site_readiness')
    const missingText = visibleText(
      renderToStaticMarkup(
        <ValidateLaunchStep
          template={ONBOARDING_TEMPLATES[0]}
          validating={false}
          validated={true}
          launched={false}
          onRunValidation={() => {}}
          onLaunch={() => {}}
          setView={() => {}}
          snapshot={missingSite}
        />,
      ),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
    expect(missingText).not.toContain('~45 min')
  })
})
