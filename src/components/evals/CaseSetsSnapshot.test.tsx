import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DEFAULT_EVAL_SNAPSHOT, NOT_IN_SNAPSHOT } from '../../data/evalSnapshot'
import { EvalCaseSetSection, JudgeCalibrationSection } from './EvalRubricParts'

function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

describe('Eval case sets & judge calibration snapshot binding (G-04)', () => {
  it('renders case_sets family totals, run_id, and by_kind counts from snapshot instead of SUITE_SIZE 84', () => {
    const snap = DEFAULT_EVAL_SNAPSHOT!
    const text = visibleText(
      renderToStaticMarkup(<EvalCaseSetSection editing={false} cases={[]} onChangeCases={() => {}} />),
    )

    expect(text).toContain(`clearauth-eval decision ${snap.case_sets.decision.number} · ${snap.case_sets.decision.status}`)
    for (const fam of snap.case_sets.families) {
      expect(text).toContain(fam.family)
      expect(text).toContain(fam.run_id)
      expect(text).toContain(fam.cases.toLocaleString('en-US'))
    }
    expect(text).toContain('benign: 404')
    expect(text).toContain('holdout: 404')
    expect(text).toContain('redteam: 72')
    expect(text).toContain('redteam_holdout: 78')
    expect(text).toContain('phi: 240')
    expect(text).toContain('dev: 600')
    expect(text).toContain('real: 80')

    expect(text).not.toContain('84')
    expect(text).not.toContain('target placeholder')
    expect(text).not.toContain('Illustrative Fixture')
  })

  it('shows not in this snapshot when case_sets or judge calibration snapshot is absent', () => {
    const nullCaseSetText = visibleText(
      renderToStaticMarkup(<EvalCaseSetSection editing={false} cases={[]} onChangeCases={() => {}} snapshot={null} />),
    )
    expect(nullCaseSetText).toContain(NOT_IN_SNAPSHOT)
    expect(nullCaseSetText).not.toContain('84')
    expect(nullCaseSetText).not.toContain('0 cases')

    const missingCaseSets = structuredClone(DEFAULT_EVAL_SNAPSHOT!) as Record<string, any>
    delete missingCaseSets.case_sets
    const missingText = visibleText(
      renderToStaticMarkup(
        <EvalCaseSetSection
          editing={false}
          cases={[]}
          onChangeCases={() => {}}
          snapshot={missingCaseSets as typeof DEFAULT_EVAL_SNAPSHOT}
        />,
      ),
    )
    expect(missingText).toContain(NOT_IN_SNAPSHOT)
    expect(missingText).not.toContain('84')

    const nullJudgeText = visibleText(renderToStaticMarkup(<JudgeCalibrationSection snapshot={null} />))
    expect(nullJudgeText).toContain(NOT_IN_SNAPSHOT)
    expect(nullJudgeText).not.toContain('0 / 50')
    expect(nullJudgeText).not.toContain('0.60')
    expect(nullJudgeText).not.toContain('50')
  })
})
