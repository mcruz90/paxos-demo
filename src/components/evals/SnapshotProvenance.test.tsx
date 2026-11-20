import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import { scenarios } from '../../data/scenarios'
import { BuildOverview } from '../BuildOverview'
import { InspectorGateColumn } from '../inspector/InspectorGateColumn'
import { ONBOARDING_TEMPLATES } from '../onboardingData'
import { ValidateLaunchStep } from '../OnboardingValidateStep'
import { EvalCaseSetSection } from './EvalRubricParts'
import { NotBuiltSnapshotCard } from './NotBuiltSnapshotCard'
import { SnapshotProvenanceBar } from './SnapshotBadges'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('Snapshot provenance & decision status labels from schema v2 (G-04)', () => {
  it('renders decision 0049 status directly from snapshot in visible text without hardcoded Proposed', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const expectedContract = `Contract: clearauth-eval decision ${snap.not_built.decision.number} · ${snap.not_built.decision.status}.`

    const surfaces = [
      visibleText(renderToStaticMarkup(<SnapshotProvenanceBar snapshot={snap} />)),
      visibleText(renderToStaticMarkup(<BuildOverview setView={() => {}} />)),
      visibleText(
        renderToStaticMarkup(
          <InspectorGateColumn
            scenario={scenarios['gilead-livdelzi']}
            steps={[]}
            streaming={false}
            activeCiteIndex={null}
            onSelectCiteIndex={() => {}}
          />,
        ),
      ),
      visibleText(
        renderToStaticMarkup(
          <ValidateLaunchStep
            template={ONBOARDING_TEMPLATES[0]}
            validating={false}
            validated={true}
            launched={false}
            onRunValidation={() => {}}
            onLaunch={() => {}}
            setView={() => {}}
          />,
        ),
      ),
      visibleText(renderToStaticMarkup(<EvalCaseSetSection editing={false} cases={[]} onChangeCases={() => {}} />)),
    ]

    for (const text of surfaces) {
      expect(text).toContain(expectedContract)
      expect(text).not.toContain('decision 0049, Proposed')
    }
  })

  it('uses snapshot decision status text directly rather than hardcoding Proposed or Accepted', () => {
    const custom = structuredClone(DEFAULT_EVAL_SNAPSHOT!)
    custom.not_built.decision = { number: '0049', status: 'Custom Status Check' }
    const text = visibleText(renderToStaticMarkup(<SnapshotProvenanceBar snapshot={custom} />))
    expect(text).toContain('clearauth-eval decision 0049 · Custom Status Check')
    expect(text).not.toContain('Proposed')
  })

  it('renders NotBuiltSnapshotCard from snapshot and falls back to not in this snapshot when absent', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const item = snap.not_built.items.find(i => i.id === 'runtime_cost')!
    const presentText = visibleText(
      renderToStaticMarkup(<NotBuiltSnapshotCard snapshot={snap} itemId="runtime_cost" heading="Runtime" />),
    )
    expect(presentText).toContain('Not built in the harness')
    expect(presentText).toContain(item.name)
    expect(presentText).toContain(item.why)
    expect(presentText).toContain(snap.not_built.decision.status)

    const nullText = visibleText(
      renderToStaticMarkup(<NotBuiltSnapshotCard snapshot={null} itemId="runtime_cost" heading="Runtime" />),
    )
    expect(nullText).toContain('Not built in the harness')
    expect(nullText).toContain(NOT_IN_SNAPSHOT)

    const missingIdSnap = structuredClone(snap)
    missingIdSnap.not_built.items = []
    const missingText = visibleText(
      renderToStaticMarkup(<NotBuiltSnapshotCard snapshot={missingIdSnap} itemId="runtime_cost" heading="Runtime" />),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
  })
})
