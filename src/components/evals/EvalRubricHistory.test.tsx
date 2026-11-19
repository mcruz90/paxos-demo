import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import * as evalRubricView from '../EvalRubricView'
import { EvalRubricView } from '../EvalRubricView'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('EvalRubricView rubric_history not_built integration (G-04)', () => {
  it('renders rubric_history not_built card on history tab and removes V1-V3 fixture history', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const historyItem = snap.not_built.items.find(i => i.id === 'rubric_history')!
    const text = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="history" snapshot={snap} />,
      ),
    )

    expect(text).toContain('Not built in the harness')
    expect(text).toContain(historyItem.name)
    expect(text).toContain(historyItem.why)
    expect(text).toContain(`clearauth-eval decision ${snap.not_built.decision.number} · ${snap.not_built.decision.status}`)

    for (const forbidden of ['Jun 6, 2026', 'Jun 11, 2026', 'Jun 17, 2026', 'Initial rubric', 'Blocked experiment']) {
      expect(text).not.toContain(forbidden)
    }
    expect('EVAL_RUBRIC_V1' in evalRubricView).toBe(false)
    expect('EVAL_RUBRIC_V2' in evalRubricView).toBe(false)
    expect('EVAL_RUBRIC_V3' in evalRubricView).toBe(false)
    expect('EVAL_RUBRIC_HISTORY' in evalRubricView).toBe(false)
  })

  it('shows not in this snapshot when snapshot or rubric_history item is missing', () => {
    const nullText = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="history" snapshot={null} />,
      ),
    )
    expect(nullText).toContain(NOT_IN_SNAPSHOT)
    expect(nullText).not.toContain('Jun 6, 2026')

    const missingHistory = structuredClone(DEFAULT_EVAL_SNAPSHOT!)
    missingHistory.not_built.items = missingHistory.not_built.items.filter(i => i.id !== 'rubric_history')
    const missingText = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="history" snapshot={missingHistory} />,
      ),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
  })

  it('renders rubric tab without v1/v2/v3 version pills while showing case_sets counts from snapshot', () => {
    const text = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="rubric" snapshot={DEFAULT_EVAL_SNAPSHOT} />,
      ),
    )
    expect(text).not.toMatch(/\bv[123]\b/i)
    expect(text).toContain('2,066 cases')
  })
})
