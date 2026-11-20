import { describe, expect, it } from 'vitest'
import { scenarios } from '../../data/scenarios'
import {
  buildRevisionInfo,
  buildVerificationStates,
  computeNarrativeDiff,
  resolveLetterNarrative,
  runLocalRevisionCheck,
} from './letterNarrative'

describe('resolveLetterNarrative', () => {
  const appeal = scenarios['novo-ozempic']
  const initial = scenarios['novo-ozempic-initial']

  it('prefers editedNarrative as unsaved_local_edit over generatedLetter and template', () => {
    const res = resolveLetterNarrative({
      scenario: appeal,
      generatedLetter: 'Generated server letter',
      editedNarrative: 'Clinician edited draft text',
    })
    expect(res).toEqual({ text: 'Clinician edited draft text', source: 'unsaved_local_edit' })
  })

  it('prefers generatedLetter as generated_artifact when no local edit exists', () => {
    const res = resolveLetterNarrative({
      scenario: appeal,
      generatedLetter: 'Real streamed server artifact',
    })
    expect(res).toEqual({ text: 'Real streamed server artifact', source: 'generated_artifact' })
  })

  it('falls back to fixture_template for initial PA and appeal scenarios', () => {
    const appealRes = resolveLetterNarrative({ scenario: appeal })
    expect(appealRes.source).toBe('fixture_template')
    expect(appealRes.text).toContain(appeal.denialReason)

    const initRes = resolveLetterNarrative({ scenario: initial })
    expect(initRes.source).toBe('fixture_template')
    expect(initRes.text.length).toBeGreaterThan(20)
  })
})

describe('buildVerificationStates', () => {
  const livdelzi = scenarios['gilead-livdelzi']
  const ozempic = scenarios['novo-ozempic']

  it('separates citation, source, contradiction, policy match, validation, and approval states without universal safety claims', () => {
    const st = buildVerificationStates({ scenario: livdelzi })
    expect(st.citationStatus).toMatch(/^\d+\/\d+ cited$/)
    expect(st.sourceStatus).toBe('Citation excerpt only')
    expect(st.contradictionStatus).toBe('1 open contradiction(s)')
    expect(st).toHaveProperty('policyMatchStatus', 'Not evaluated')
    expect(st).toHaveProperty('validationStatus', 'Not evaluated')
    expect(st).not.toHaveProperty('gateStatus')
    expect(st.approvalStatus).toBe('Unsigned draft — pending human approval')
  })

  it('marks edited drafts as unsaved local draft and formats policy match without marking validation evaluated', () => {
    const st = buildVerificationStates({
      scenario: ozempic,
      editedNarrative: 'edited paragraph',
      gateResolution: 'plan_id',
    })
    expect(st.sourceStatus).toBe('Full documents indexed')
    expect(st.contradictionStatus).toBe('0 open in checklist')
    expect(st).toHaveProperty('policyMatchStatus', 'plan_id')
    expect(st).toHaveProperty('validationStatus', 'Not evaluated')
    expect(st).not.toHaveProperty('gateStatus')
    expect(st.approvalStatus).toBe('Unsaved local draft — not validated')

    const genericHold = buildVerificationStates({
      scenario: ozempic,
      gateResolution: 'generic',
    })
    expect(genericHold).toHaveProperty('policyMatchStatus', 'generic — hold, no specific policy')
    expect(genericHold).toHaveProperty('validationStatus', 'Not evaluated')
  })
})

describe('revision tracking, narrative diff & local structure check', () => {
  const ozempic = scenarios['novo-ozempic']

  it('tracks Rev 1 AI Draft vs Rev 2 Clinician Edit and local validation state', () => {
    expect(buildRevisionInfo({ baselineText: 'orig', editedNarrative: undefined, locallyCheckedRev2: false })).toEqual({
      revisionLabel: 'Rev 1 · AI Draft',
      isEdited: false,
      localCheckLabel: 'Baseline template',
    })
    expect(buildRevisionInfo({ baselineText: 'orig', editedNarrative: 'edited', locallyCheckedRev2: false })).toEqual({
      revisionLabel: 'Rev 2 · Clinician Edit',
      isEdited: true,
      localCheckLabel: 'Validation Required',
    })
    expect(buildRevisionInfo({ baselineText: 'orig', editedNarrative: 'edited', locallyCheckedRev2: true }).localCheckLabel).toBe(
      'Local structure checked (not backend gate)',
    )
  })

  it('computes changed lines/words summary between Rev 1 and Rev 2 and verifies drug/diagnosis retention', () => {
    const diff = computeNarrativeDiff('Request for Ozempic in T2DM.', 'Request for Ozempic 0.5mg in E11.9 T2DM.')
    expect(diff.baseline).toBe('Request for Ozempic in T2DM.')
    expect(diff.edited).toBe('Request for Ozempic 0.5mg in E11.9 T2DM.')
    expect(diff.changed).toBe(true)

    expect(runLocalRevisionCheck({ text: `Appeal for ${ozempic.drug} treating ${ozempic.diagnosis}`, scenario: ozempic }).passed).toBe(true)
    expect(runLocalRevisionCheck({ text: 'Unrelated generic note', scenario: ozempic }).passed).toBe(false)
  })
})
