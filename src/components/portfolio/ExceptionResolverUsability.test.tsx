import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import { EvidenceDiscoveryConsole } from './EvidenceDiscoveryConsole'
import { buildCriterionResolverContext, summarizeGap } from './exceptionResolver'
import { ExceptionResolverModal } from './ExceptionResolverModal'
import { nextTrappedFocusIndex } from './useDialogFocus'

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('ExceptionResolverModal & EvidenceDiscoveryConsole usability (2b, 2c, 2d, 2e)', () => {
  const humira = scenarios['humira-cigna']
  const humiraCrit = humira.criteriaResults.find(c => c.status === 'needs_review')!
  const humiraCtx = buildCriterionResolverContext(humira, humiraCrit)

  const livdelzi = scenarios['gilead-livdelzi']
  const livdelziConflictCrit = livdelzi.criteriaResults.find(c => c.status === 'conflict')!
  const livdelziConflictCtx = buildCriterionResolverContext(livdelzi, livdelziConflictCrit)

  const ozempicGap = scenarios['novo-ozempic-docgap']
  const ozempicGapCrit = ozempicGap.criteriaResults.find(c => c.status === 'needs_review')!
  const ozempicGapCtx = buildCriterionResolverContext(ozempicGap, ozempicGapCrit)

  it('2b: shows concise gap summary, collapsed expandable policy detail, and persistent selected-evidence bar with remove controls', () => {
    const summary = summarizeGap(humiraCtx.policyNote)
    expect(summary.length).toBeLessThanOrEqual(120)
    expect(humiraCtx.gapSummary).toBe(summary)

    const ehrOpt = humiraCtx.options.find(o => o.id === 'ehr')!
    const html = renderToStaticMarkup(
      <ExceptionResolverModal
        ctx={humiraCtx}
        applyLabel="Apply Resolution"
        initialAttached={[{ id: ehrOpt.id, title: ehrOpt.title, detail: ehrOpt.detail }]}
        onApply={() => {}}
        onClose={() => {}}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain(humiraCtx.gapSummary)
    expect(text).toContain('Show policy detail')
    expect(html).toContain('aria-expanded="false"')
    expect(text).not.toContain('whose criteria are not fully in the submitted record')

    expect(html).toContain('data-testid="selected-evidence-bar"')
    expect(html.indexOf('data-testid="selected-evidence-bar"')).toBeLessThan(html.indexOf('overflow-y-auto'))
    expect(html).toContain(`aria-label="Remove ${ehrOpt.title}"`)
  })

  it('2c-dialog: sets dialog ARIA semantics, keyboard-focusable action card, and wraps trapped focus cleanly', () => {
    const html = renderToStaticMarkup(
      <ExceptionResolverModal
        ctx={humiraCtx}
        applyLabel="Apply Resolution"
        onApply={() => {}}
        onClose={() => {}}
      />,
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-labelledby=')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>[\s\S]*?Send Provider In-Basket \/ Outbound Query/)

    expect(nextTrappedFocusIndex(0, 4, true)).toBe(3)
    expect(nextTrappedFocusIndex(3, 4, false)).toBe(0)
    expect(nextTrappedFocusIndex(-1, 4, false)).toBe(0)
    expect(nextTrappedFocusIndex(-1, 4, true)).toBe(3)
    expect(nextTrappedFocusIndex(0, 0, false)).toBe(-1)
  })

  it('2d & 2e: uses Find patient records wording, SIMULATED label, supporting-or-conflicting copy, surfaces conflicts, and blocks auto-resolution on empty', () => {
    const consoleHtml = renderToStaticMarkup(
      <EvidenceDiscoveryConsole ctx={humiraCtx} selected={[]} onAttach={() => {}} />,
    )
    const consoleText = visibleText(consoleHtml)
    expect(consoleText).toContain('Find patient records')
    expect(consoleText).toContain('SIMULATED')
    expect(consoleText).not.toContain('Auto-verify EHR')
    expect(consoleText.toLowerCase()).toContain('supporting or conflicting')

    const conflictText = visibleText(
      renderToStaticMarkup(
        <EvidenceDiscoveryConsole ctx={livdelziConflictCtx} selected={[]} onAttach={() => {}} />,
      ),
    )
    expect(conflictText).toMatch(/Conflicting/i)
    expect(conflictText).toContain('Hepatology Consult, p.1')
    expect(conflictText).toContain('Discharge Summary, p.2')
    expect(conflictText).toContain('DOES NOT AUTO-RESOLVE')

    const emptyJustifyHtml = renderToStaticMarkup(
      <ExceptionResolverModal
        ctx={ozempicGapCtx}
        applyLabel="Apply Resolution"
        initialPath="justify"
        onApply={() => {}}
        onClose={() => {}}
      />,
    )
    expect(emptyJustifyHtml).toMatch(/<button[^>]*disabled=""[^>]*>Attach &amp; Reassess Criterion<\/button>/)
  })
})
