import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { CaseActionFooter } from './CaseActionFooter'
import splitPortfolioSource from './SplitPortfolioView.tsx?raw'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('Explicit exception status transition contract (A11)', () => {
  const exceptionClient = initialClients.find(c => c.status === 'exception')!
  const exceptionScenario = scenarios[exceptionClient.scenarioId]

  it('does not auto-transition exception cases with setTimeout in SplitPortfolioView', () => {
    expect(splitPortfolioSource).toContain('resolveExplicitCaseTransition')
    expect(splitPortfolioSource).not.toMatch(/setTimeout\s*\([\s\S]*?onUpdateClientStatus/)
  })

  it('renders an explicit Move to Awaiting Documentation action when all exceptions resolve via dispatch', () => {
    const html = renderToStaticMarkup(
      <CaseActionFooter
        client={exceptionClient}
        scenario={exceptionScenario}
        hasUnresolvedRemaining={false}
        letterOnScreen={false}
        letterReviewed={false}
        pendingTransition={{
          nextStatus: 'awaiting_documentation',
          actionLabel: 'Move to Awaiting Documentation',
          summary: 'All exceptions addressed locally. Confirm moving this case to Awaiting Documentation.',
        }}
        onConfirmStatusTransition={() => {}}
        onPrint={() => {}}
        onQuickApprove={() => {}}
        onGoToLetter={() => {}}
        onViewActivity={() => {}}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('Move to Awaiting Documentation')
    expect(text).not.toContain('Syncing clinical records from Epic FHIR')
  })

  it('renders an explicit Move to Ready for Review action when all exceptions resolve via override', () => {
    const html = renderToStaticMarkup(
      <CaseActionFooter
        client={exceptionClient}
        scenario={exceptionScenario}
        hasUnresolvedRemaining={false}
        letterOnScreen={false}
        letterReviewed={false}
        pendingTransition={{
          nextStatus: 'ready_for_review',
          actionLabel: 'Move to Ready for Review',
          summary: 'All exceptions addressed locally. Confirm moving this case to Ready for Review.',
        }}
        onConfirmStatusTransition={() => {}}
        onPrint={() => {}}
        onQuickApprove={() => {}}
        onGoToLetter={() => {}}
        onViewActivity={() => {}}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('Move to Ready for Review')
    expect(text).not.toContain('Syncing clinical records from Epic FHIR')
  })
})
