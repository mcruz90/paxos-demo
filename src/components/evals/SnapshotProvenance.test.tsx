import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT } from '../../data/evalSnapshot'
import { scenarios } from '../../data/scenarios'
import { BuildOverview } from '../BuildOverview'
import { InspectorGateColumn } from '../inspector/InspectorGateColumn'
import { ONBOARDING_TEMPLATES } from '../onboardingData'
import { ValidateLaunchStep } from '../OnboardingValidateStep'
import { EvalCaseSetSection } from './EvalRubricParts'
import { SnapshotProvenanceBar } from './SnapshotBadges'

const EXPECTED_CONTRACT = 'Contract: clearauth-eval decision 0049, Proposed.'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('Snapshot provenance visible contract text (L-a)', () => {
  it('renders decision 0049 Proposed contract note in visible text, not only tooltips', () => {
    expect(visibleText(renderToStaticMarkup(<SnapshotProvenanceBar snapshot={DEFAULT_EVAL_SNAPSHOT!} />))).toContain(
      EXPECTED_CONTRACT,
    )
    expect(visibleText(renderToStaticMarkup(<BuildOverview setView={() => {}} />))).toContain(EXPECTED_CONTRACT)
    expect(
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
    ).toContain(EXPECTED_CONTRACT)
    expect(
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
    ).toContain(EXPECTED_CONTRACT)
    expect(
      visibleText(renderToStaticMarkup(<EvalCaseSetSection editing={false} cases={[]} onChangeCases={() => {}} />)),
    ).toContain(EXPECTED_CONTRACT)
  })
})
