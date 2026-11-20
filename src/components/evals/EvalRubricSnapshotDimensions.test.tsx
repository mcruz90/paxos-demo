import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import { EvalRubricView } from '../EvalRubricView'

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('EvalRubricView appeal_rubric snapshot binding & header honesty (G4-L1)', () => {
  it('reads all rubric dimensions from appeal_rubric in the snapshot and removes IllustrativeTag and fixture percentages', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const text = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="rubric" snapshot={snap} />,
      ),
    )

    expect(snap.appeal_rubric.dimensions.length).toBeGreaterThanOrEqual(14)
    for (const dim of snap.appeal_rubric.dimensions) {
      expect(text).toContain(dim.id)
      expect(text).toContain(dim.question)
    }
    expect(text).toContain(`clearauth-eval decision ${snap.appeal_rubric.decision.number} · ${snap.appeal_rubric.decision.status}`)

    expect(text).not.toContain('Illustrative · demo scenario')
    for (const forbidden of [
      'Over-Caution Rate',
      'gatekeeper.assert',
      'appeal_eval.rubric.structure',
      '≥ 85%',
      '≥ 90%',
      '≥ 95%',
      '≥ 80%',
    ]) {
      expect(text).not.toContain(forbidden)
    }
  })

  it('shows not in this snapshot without falling back to RUBRIC_DIMENSIONS when appeal_rubric is absent', () => {
    const nullText = visibleText(
      renderToStaticMarkup(
        <EvalRubricView setView={() => {}} onOpenCase={() => {}} initialTab="rubric" snapshot={null} />,
      ),
    )
    expect(nullText).toContain(NOT_IN_SNAPSHOT)
    expect(nullText).not.toContain('Illustrative · demo scenario')
    for (const forbidden of ['Over-Caution Rate', 'Safety Gate', 'D1_gate_passed', 'gatekeeper.assert']) {
      expect(nullText).not.toContain(forbidden)
    }

    const noRubric = structuredClone(DEFAULT_EVAL_SNAPSHOT!) as Record<string, any>
    delete noRubric.appeal_rubric
    const missingText = visibleText(
      renderToStaticMarkup(
        <EvalRubricView
          setView={() => {}}
          onOpenCase={() => {}}
          initialTab="rubric"
          snapshot={noRubric as typeof DEFAULT_EVAL_SNAPSHOT}
        />,
      ),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
    for (const forbidden of ['Over-Caution Rate', 'Safety Gate', 'D1_gate_passed', 'gatekeeper.assert']) {
      expect(missingText).not.toContain(forbidden)
    }
  })
})
