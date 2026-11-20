import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { shellModeBadge } from '../../capabilities'
import { scenarios } from '../../data/scenarios'
import { ReviewPolicyControl } from '../ReviewPolicyControl'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import { CitationPane } from './CitationPane'
import { type CriterionActions, CriterionRow } from './CriterionRow'
import { FixtureChat } from './FixtureChat'
import { CitationPill, CitedCriterionRow } from './LetterPreviewParts'
import { RedactionLedger } from './RedactionLedger'

const noopActions: CriterionActions = {
  stageDispatch: () => {},
  cancelDispatch: () => {},
  confirmDispatch: () => {},
  startOverride: () => {},
  cancelOverride: () => {},
  applyOverride: () => {},
  setOverrideInput: () => {},
}

describe('Accessible icon-only controls, keyboard citations, and long finding expansion (2c & 2a)', () => {
  it('gives every icon-only button a semantic aria-label', () => {
    const chatHtml = renderToStaticMarkup(
      <FixtureChat suggestions={[]} deferralReply="deferred" placeholder="Ask..." />,
    )
    expect(chatHtml).toContain('aria-label="Send question"')

    const ledgerHtml = renderToStaticMarkup(
      <RedactionLedger entries={[]} open={true} onClose={() => {}} />,
    )
    expect(ledgerHtml).toContain('aria-label="Close redaction ledger"')

    const modeBadge = shellModeBadge(false)
    const collapsedSidebarHtml = renderToStaticMarkup(
      <Sidebar
        view="portfolio"
        setView={() => {}}
        activeRole="Operate"
        onStartTour={() => {}}
        isCollapsed={true}
        onToggleCollapse={() => {}}
        modeBadge={modeBadge}
      />,
    )
    expect(collapsedSidebarHtml).toContain('aria-label="Expand sidebar"')
    expect(collapsedSidebarHtml).toContain(`aria-label="${modeBadge.wordmark} — Guided Tour"`)

    const expandedSidebarHtml = renderToStaticMarkup(
      <Sidebar
        view="portfolio"
        setView={() => {}}
        activeRole="Operate"
        onStartTour={() => {}}
        isCollapsed={false}
        onToggleCollapse={() => {}}
        modeBadge={modeBadge}
      />,
    )
    expect(expandedSidebarHtml).toContain('aria-label="Collapse sidebar"')

    const topbarHtml = renderToStaticMarkup(
      <Topbar
        activeRole="Operate"
        onRoleChange={() => {}}
        theme="light"
        onToggleTheme={() => {}}
        onStartTour={() => {}}
        modeBadge={modeBadge}
      />,
    )
    expect(topbarHtml).toContain('aria-label="Switch to Dark mode"')
    expect(topbarHtml).toContain('aria-label="Guided Tour"')

    const switchHtml = renderToStaticMarkup(<ReviewPolicyControl />)
    expect(switchHtml).toContain('aria-label="Auto-assemble and queue routine prior authorizations"')
  })

  it('makes citation cards and criteria rows keyboard operable and lets long resolved findings expand', () => {
    const esomeprazole = scenarios['pediatric-esomeprazole']
    const citationPaneHtml = renderToStaticMarkup(
      <CitationPane scenario={esomeprazole} highlightedIndex={0} onSelectIndex={() => {}} />,
    )
    expect(citationPaneHtml).toContain('<button type="button" data-cite-index="0"')
    expect(citationPaneHtml).toContain('aria-pressed="true"')

    const conflictCrit = scenarios['gilead-livdelzi'].criteriaResults[2]
    const conflictHtml = renderToStaticMarkup(
      <CriterionRow
        index={1}
        criterion={conflictCrit}
        localState={EMPTY_LOCAL_CASE_STATE}
        actions={noopActions}
        isSelected={false}
        onSelect={() => {}}
      />,
    )
    expect(conflictHtml).not.toContain('line-clamp-2')
    expect(conflictHtml).toContain(`aria-pressed="false"`)

    const longResolvedCrit = scenarios['humira-cigna'].criteriaResults[0]
    expect(longResolvedCrit.note.length).toBeGreaterThan(140)
    const longResolvedHtml = renderToStaticMarkup(
      <CriterionRow
        index={1}
        criterion={longResolvedCrit}
        localState={EMPTY_LOCAL_CASE_STATE}
        actions={noopActions}
        isSelected={true}
        onSelect={() => {}}
      />,
    )
    expect(longResolvedHtml).toContain('aria-pressed="true"')
    expect(longResolvedHtml).toContain('aria-expanded="false"')
    expect(longResolvedHtml).toContain('Show full finding')

    const pillHtml = renderToStaticMarkup(
      <CitationPill index={0} source="Pediatric GI Consult" page="p. 1" active={true} onSelect={() => {}} />,
    )
    expect(pillHtml).toContain('aria-pressed="true"')

    const citedRowHtml = renderToStaticMarkup(
      <CitedCriterionRow
        index={0}
        scenario={esomeprazole}
        heading="1. Confirmed GERD"
        showAnswer={false}
        active={false}
        onSelect={() => {}}
      />,
    )
    expect(citedRowHtml).toMatch(/<button[^>]*type="button"[^>]*aria-pressed="false"[^>]*>1\. Confirmed GERD<\/button>/)
  })
})
