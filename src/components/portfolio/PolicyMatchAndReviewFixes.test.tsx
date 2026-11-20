import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EVAL_SNAPSHOT,
  type EvalSnapshot,
  NOT_IN_SNAPSHOT,
} from '../../data/evalSnapshot'
import { initialClients, scenarios } from '../../data/scenarios'
import { AuthoredRubricCriteriaSection, JudgeCalibrationSection } from '../evals/EvalRubricParts'
import { buildLetterActionStatus, CaseActionFooter } from './CaseActionFooter'
import { buildRevisionInfo, buildVerificationStates } from './letterNarrative'
import { LetterVerificationBar } from './LetterPreviewParts'
import { LiveLetterGeneration } from './LiveLetterGeneration'
import liveGenSource from './LiveLetterGeneration.tsx?raw'
import useDialogFocusSource from './useDialogFocus.ts?raw'

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

describe('CaseActionFooter policy match & validation separation (M1)', () => {
  const readyClient = { ...initialClients[0], status: 'ready_for_review' as const }
  const scenario = scenarios['novo-ozempic']
  const noop = () => {}

  it('keeps validation as not evaluated, refuses approval eligibility from pa_resolution, and flags generic as a hold', () => {
    const status = buildLetterActionStatus({
      clientStatus: 'ready_for_review',
      hasUnresolvedRemaining: false,
      editedNarrative: undefined,
      gateResolution: 'generic',
    })
    expect(status.validationState).toBe('not evaluated')
    expect(status.approvalEligibility).toContain('Not evaluated')
    expect(status.approvalEligibility).not.toBe('Pending clinician sign-off')

    const text = visibleText(
      renderToStaticMarkup(
        <CaseActionFooter
          client={readyClient}
          scenario={scenario}
          hasUnresolvedRemaining={false}
          letterOnScreen={true}
          letterReviewed={true}
          editedNarrative={undefined}
          gateResolution="generic"
          onPrint={noop}
          onQuickApprove={noop}
          onGoToLetter={noop}
          onViewActivity={noop}
        />,
      ),
    )

    expect(text).toContain('Validation: not evaluated')
    expect(text).toContain('Policy match: generic — hold, no specific policy')
    expect(text).not.toContain('Pending clinician sign-off')
    expect(text).not.toContain('Validation: generic')
  })

  it('shows Policy match: plan_id without marking validation evaluated or promoting approval eligibility', () => {
    const status = buildLetterActionStatus({
      clientStatus: 'ready_for_review',
      hasUnresolvedRemaining: false,
      editedNarrative: undefined,
      gateResolution: 'plan_id',
    })
    expect(status.validationState).toBe('not evaluated')
    expect(status.approvalEligibility).toContain('Not evaluated')
    expect(status.approvalEligibility).not.toBe('Pending clinician sign-off')

    const text = visibleText(
      renderToStaticMarkup(
        <CaseActionFooter
          client={readyClient}
          scenario={scenario}
          hasUnresolvedRemaining={false}
          letterOnScreen={true}
          letterReviewed={true}
          editedNarrative={undefined}
          gateResolution="plan_id"
          onPrint={noop}
          onQuickApprove={noop}
          onGoToLetter={noop}
          onViewActivity={noop}
        />,
      ),
    )

    expect(text).toContain('Validation: not evaluated')
    expect(text).toContain('Policy match: plan_id')
    expect(text).not.toContain('Pending clinician sign-off')
    expect(text).not.toContain('Validation: plan_id')
  })
})

describe('LiveLetterGeneration & LetterVerificationBar Policy match labels (L1)', () => {
  const ozempic = scenarios['novo-ozempic']
  const noop = () => {}

  it('labels milestone as Policy match instead of Gatekeeper Status', () => {
    const html = visibleText(
      renderToStaticMarkup(
        <LiveLetterGeneration scenario={ozempic} csrfToken="" onExpire={noop} onComplete={noop} />,
      ),
    )
    expect(html).toContain('Policy match: Not evaluated')
    expect(html).not.toContain('Gatekeeper Status')
    expect(liveGenSource).not.toContain('Gatekeeper Status')
    expect(liveGenSource).toContain('Policy match:')
    expect(liveGenSource).toContain('formatPolicyMatch')
  })

  it('renders Policy match (with generic hold wording) and Validation pills in LetterVerificationBar', () => {
    const states = buildVerificationStates({ scenario: ozempic, gateResolution: 'generic' })
    const rev = buildRevisionInfo({ baselineText: 'draft', editedNarrative: undefined, locallyCheckedRev2: false })
    const html = visibleText(
      renderToStaticMarkup(
        <LetterVerificationBar
          states={states}
          revisionInfo={rev}
          showDiff={false}
          onToggleDiff={noop}
          onRunLocalCheck={noop}
          mode="verify"
          onSetMode={noop}
        />,
      ),
    )
    expect(html).toContain('Policy match: generic — hold, no specific policy')
    expect(html).toContain('Validation: Not evaluated')
    expect(html).not.toContain('Gate: generic')
  })
})

describe('EvalRubricParts dynamic judge dimension range and state (L4)', () => {
  it('derives range J1–J2 and measured state from snapshot.appeal_rubric without hardcoding J1–J4 or not run yet', () => {
    const twoJudgeMeasuredSnap: EvalSnapshot = {
      ...structuredClone(DEFAULT_EVAL_SNAPSHOT!),
      appeal_rubric: {
        ...structuredClone(DEFAULT_EVAL_SNAPSHOT!.appeal_rubric!),
        state: 'measured',
        dimensions: DEFAULT_EVAL_SNAPSHOT!.appeal_rubric!.dimensions
          .filter(d => d.kind !== 'judge' || d.id.startsWith('J1') || d.id.startsWith('J2'))
          .map(d =>
            d.kind === 'judge'
              ? { ...d, state: 'measured', calibration: { n: 50, kappa: 0.72, calibrated: true } }
              : d,
          ),
      },
    }

    const rubricHtml = visibleText(
      renderToStaticMarkup(<AuthoredRubricCriteriaSection snapshot={twoJudgeMeasuredSnap} />),
    )
    expect(rubricHtml).toContain('J1–J2')
    expect(rubricHtml).toContain('measured')
    expect(rubricHtml).not.toContain('J1–J4')
    expect(rubricHtml).not.toContain('not run yet')
    expect(rubricHtml).not.toContain('no judge runs today')

    const calHtml = visibleText(
      renderToStaticMarkup(<JudgeCalibrationSection snapshot={twoJudgeMeasuredSnap} />),
    )
    expect(calHtml).toContain('J1–J2')
    expect(calHtml).not.toContain('J1–J4')
    expect(calHtml).not.toContain('no model judge runs yet')
  })

  it('omits hardcoded J1–J4 and not run yet when appeal_rubric is missing', () => {
    const missingRubric = visibleText(renderToStaticMarkup(<AuthoredRubricCriteriaSection snapshot={null} />))
    expect(missingRubric).toContain(NOT_IN_SNAPSHOT)
    expect(missingRubric).not.toContain('J1–J4')
    expect(missingRubric).not.toContain('not run yet')

    const missingCal = visibleText(renderToStaticMarkup(<JudgeCalibrationSection snapshot={null} />))
    expect(missingCal).toContain(NOT_IN_SNAPSHOT)
    expect(missingCal).not.toContain('J1–J4')
  })
})

describe('useDialogFocus ref sync inside useEffect (L5)', () => {
  it('syncs onCloseRef inside useEffect rather than during render', () => {
    expect(useDialogFocusSource).toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*\{\s*onCloseRef\.current\s*=\s*onClose/)
  })
})
