import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import { EvalRunResultsPanel } from '../EvalRunResultsPanel'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('EvalRunResultsPanel schema v2 & not_built cards (G-04)', () => {
  it('renders redteam metrics and runtime_cost / per_case_results not_built items without fixture scores', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const runtimeItem = snap.not_built.items.find(i => i.id === 'runtime_cost')!
    const perCaseItem = snap.not_built.items.find(i => i.id === 'per_case_results')!
    const text = visibleText(renderToStaticMarkup(<EvalRunResultsPanel onOpenCase={() => {}} snapshot={snap} />))

    // Red-team numbers from snapshot
    expect(text).toContain(snap.redteam.run_id!)
    expect(text).toContain(`clearauth-eval decision ${snap.redteam.decision.number} · ${snap.redteam.decision.status}`)
    expect(text).toContain('redteam')
    expect(text).toContain('72 / 72')
    expect(text).toContain('0.00%–5.07%')
    expect(text).toContain('redteam_holdout')
    expect(text).toContain('72 / 78')
    expect(text).toContain('3.57%–15.78%')

    // No illustrative red-team probes
    for (const forbidden of ['PHI Leak', 'Prompt Injection', 'Jailbreak', '23/24', '8/8', '9/10', '6/6']) {
      expect(text).not.toContain(forbidden)
    }

    // not_built items replace runtime_cost and per_case_results
    expect(text).toContain('Not built in the harness')
    expect(text).toContain(runtimeItem.name)
    expect(text).toContain(runtimeItem.why)
    expect(text).toContain(perCaseItem.name)
    expect(text).toContain(perCaseItem.why)

    // No illustrative runtime or per-case fixture numbers
    for (const forbidden of [
      '$0.041',
      '8.3s',
      '19.4s',
      '13,900',
      'claude-haiku-4-5',
      '$0.004',
      '$0.006',
      '$0.031',
      'Demo Fixture Preview',
      'demo-fixture-preview',
      'Fixture 7 / 9',
      'ozempic-routine',
      'esomeprazole-round2',
      '0.71',
      '0.62',
      '18/18',
      '16/18',
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('shows not in this snapshot when snapshot or redteam/not_built entries are missing', () => {
    const nullText = visibleText(renderToStaticMarkup(<EvalRunResultsPanel onOpenCase={() => {}} snapshot={null} />))
    expect(nullText).toContain(NOT_IN_SNAPSHOT)
    expect(nullText).not.toContain('0 / 0')
    expect(nullText).not.toContain('$0.041')
    expect(nullText).not.toContain('PHI Leak')

    const missingSections = structuredClone(DEFAULT_EVAL_SNAPSHOT!) as Record<string, any>
    delete missingSections.redteam
    missingSections.not_built.items = []
    const missingText = visibleText(
      renderToStaticMarkup(
        <EvalRunResultsPanel onOpenCase={() => {}} snapshot={missingSections as typeof DEFAULT_EVAL_SNAPSHOT} />,
      ),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
    expect(missingText).not.toContain('72 / 72')
    expect(missingText).not.toContain('PHI Leak')
  })
})
