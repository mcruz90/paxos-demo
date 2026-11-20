import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { CaseTimeline } from '../poc/CaseTimeline'
import { CaseActionFooter } from './CaseActionFooter'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import { type CriterionActions } from './CriterionRow'
import { EvidencePane } from './EvidencePane'
import { PreviewPane } from './PreviewPane'

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const noopActions: CriterionActions = {
  stageDispatch: () => {},
  cancelDispatch: () => {},
  confirmDispatch: () => {},
  startOverride: () => {},
  cancelOverride: () => {},
  applyOverride: () => {},
  setOverrideInput: () => {},
}

describe('Workspace room (2a) & letter-action status strip (2f)', () => {
  const esomeprazole = scenarios['pediatric-esomeprazole']
  const esomeprazoleClient = initialClients.find(c => c.scenarioId === 'pediatric-esomeprazole')!
  const readyClient = initialClients.find(c => c.scenarioId === 'novo-ozempic-initial')!
  const readyScenario = scenarios['novo-ozempic-initial']

  it('wraps compact timeline, full timeline, and preview tabs without horizontal overflow and compacts EvidencePane', () => {
    const compactTimelineHtml = renderToStaticMarkup(<CaseTimeline events={esomeprazole.timeline!} compact />)
    expect(compactTimelineHtml).toContain('data-testid="case-timeline"')
    expect(compactTimelineHtml).toContain('flex-wrap')
    expect(compactTimelineHtml).not.toContain('overflow-x-auto')

    const fullTimelineHtml = renderToStaticMarkup(<CaseTimeline events={esomeprazole.timeline!} />)
    expect(fullTimelineHtml).toContain('flex-wrap')

    const previewHtml = renderToStaticMarkup(
      <PreviewPane
        client={esomeprazoleClient}
        scenario={esomeprazole}
        localState={EMPTY_LOCAL_CASE_STATE}
        actions={noopActions}
        onQuickApprove={() => {}}
        onPayerDecision={() => {}}
        selectedCiteIndex={null}
        onSelectCiteIndex={() => {}}
        activeTab="checklist"
        setActiveTab={() => {}}
        activeDocId={null}
        onViewDoc={() => {}}
        generateCap="simulated"
      />,
    )
    expect(previewHtml).toContain('data-testid="preview-tab-bar"')
    expect(previewHtml).toMatch(/data-testid="preview-tab-bar"[^>]*flex-wrap/)
    expect(previewHtml).not.toMatch(/data-testid="preview-tab-bar"[^>]*overflow-x-auto/)

    const evidenceHtml = renderToStaticMarkup(
      <EvidencePane
        scenario={esomeprazole}
        phi={null}
        showCitations={true}
        onToggleCitations={() => {}}
        citeView="source"
        setCiteView={() => {}}
        activeCiteIndex={null}
        onSelectCiteIndex={() => {}}
        activeDocId={null}
        onSelectDoc={() => {}}
      />,
    )
    expect(evidenceHtml).toContain('w-[360px]')
    expect(evidenceHtml).toContain('aria-expanded="true"')
    expect(evidenceHtml).not.toContain('xl:w-[480px]')
    expect(evidenceHtml).not.toContain('w-[420px]')
  })

  it('shows honest artifact version, validation state, and approval eligibility near letter actions', () => {
    const footerHtml = renderToStaticMarkup(
      <CaseActionFooter
        client={readyClient}
        scenario={readyScenario}
        hasUnresolvedRemaining={false}
        letterOnScreen={true}
        letterReviewed={true}
        onPrint={() => {}}
        onQuickApprove={() => {}}
        onGoToLetter={() => {}}
        onViewActivity={() => {}}
      />,
    )
    expect(footerHtml).toContain('data-testid="letter-action-status"')
    const text = visibleText(footerHtml)
    expect(text).toContain('Unsaved local draft — not validated')
    expect(text).toContain('not evaluated')
    expect(text).toContain('Approval:')

    const editedText = visibleText(
      renderToStaticMarkup(
        <CaseActionFooter
          client={readyClient}
          scenario={readyScenario}
          hasUnresolvedRemaining={false}
          letterOnScreen={true}
          letterReviewed={true}
          editedNarrative="Edited narrative body"
          gateResolution="plan_id"
          onPrint={() => {}}
          onQuickApprove={() => {}}
          onGoToLetter={() => {}}
          onViewActivity={() => {}}
        />,
      ),
    )
    expect(editedText).toContain('Unsaved local draft — not validated')
    expect(editedText).toContain('Validation: not evaluated')
    expect(editedText).toContain('Not eligible for live filing')

    const blockedText = visibleText(
      renderToStaticMarkup(
        <CaseActionFooter
          client={readyClient}
          scenario={readyScenario}
          hasUnresolvedRemaining={true}
          letterOnScreen={true}
          letterReviewed={false}
          onPrint={() => {}}
          onQuickApprove={() => {}}
          onGoToLetter={() => {}}
          onViewActivity={() => {}}
        />,
      ),
    )
    expect(blockedText).toContain('Not eligible — unresolved exceptions in checklist')
  })
})
