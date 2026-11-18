import { type ScenarioConfig } from '../../types'
import { buildPaRequestNarrative } from '../poc/letter'

export type NarrativeSource = 'unsaved_local_edit' | 'generated_artifact' | 'fixture_template'

export interface ResolvedNarrative {
  text: string
  source: NarrativeSource
}

export interface VerificationStates {
  citationStatus: string
  sourceStatus: string
  contradictionStatus: string
  gateStatus: string
  approvalStatus: string
}

export function resolveLetterNarrative({
  scenario,
  generatedLetter,
  editedNarrative,
}: {
  scenario: ScenarioConfig
  generatedLetter?: string
  editedNarrative?: string
}): ResolvedNarrative {
  if (editedNarrative && editedNarrative.trim().length > 0) {
    return { text: editedNarrative, source: 'unsaved_local_edit' }
  }
  if (generatedLetter && generatedLetter.trim().length > 0) {
    return { text: generatedLetter, source: 'generated_artifact' }
  }
  const isInitial = scenario.lifecycle === 'initial_pa'
  const templateText = isInitial
    ? buildPaRequestNarrative(scenario)
    : `We are writing to formally appeal the prior authorization denial for ${scenario.drug}. The denial cited "${scenario.denialReason}." Upon thorough review of the patient's clinical record, all applicable criteria for ${scenario.diagnosis} are addressed below.`
  return { text: templateText, source: 'fixture_template' }
}

export function buildVerificationStates({
  scenario,
  editedNarrative,
  gateResolution,
}: {
  scenario: ScenarioConfig
  editedNarrative?: string
  gateResolution?: string | null
}): VerificationStates {
  const total = scenario.criteriaResults.length
  const citedCount = scenario.criteriaResults.filter(cr => !!scenario.citations[cr.rule.label]).length
  const hasFullDocs = !!(scenario.sourceDocuments && scenario.sourceDocuments.length > 0)
  const contradictions = scenario.criteriaResults.filter(cr => cr.status === 'conflict').length

  return {
    citationStatus: `${citedCount}/${total} cited`,
    sourceStatus: hasFullDocs ? 'Full documents indexed' : 'Citation excerpt only',
    contradictionStatus: contradictions > 0 ? `${contradictions} open contradiction(s)` : '0 open in checklist',
    gateStatus: gateResolution && gateResolution.trim().length > 0 ? gateResolution : 'Not evaluated',
    approvalStatus: editedNarrative ? 'Unsaved local draft — not validated' : 'Unsigned draft — pending human approval',
  }
}
