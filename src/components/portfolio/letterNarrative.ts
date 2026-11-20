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
  policyMatchStatus: string
  validationStatus: string
  approvalStatus: string
}

export function formatPolicyMatch(paResolution?: string | null): string {
  const trimmed = paResolution?.trim() ?? ''
  if (!trimmed) return 'Not evaluated'
  if (trimmed === 'generic') return 'generic — hold, no specific policy'
  return trimmed
}

export interface RevisionInfo {
  revisionLabel: string
  isEdited: boolean
  localCheckLabel: string
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
    policyMatchStatus: formatPolicyMatch(gateResolution),
    validationStatus: 'Not evaluated',
    approvalStatus: editedNarrative ? 'Unsaved local draft — not validated' : 'Unsigned draft — pending human approval',
  }
}

export function buildRevisionInfo({
  baselineText,
  editedNarrative,
  locallyCheckedRev2,
}: {
  baselineText: string
  editedNarrative?: string
  locallyCheckedRev2: boolean
}): RevisionInfo {
  if (!editedNarrative || editedNarrative.trim() === baselineText.trim()) {
    return { revisionLabel: 'Rev 1 · AI Draft', isEdited: false, localCheckLabel: 'Baseline template' }
  }
  return {
    revisionLabel: 'Rev 2 · Clinician Edit',
    isEdited: true,
    localCheckLabel: locallyCheckedRev2 ? 'Local structure checked (not backend gate)' : 'Validation Required',
  }
}

export function computeNarrativeDiff(baselineText: string, editedText: string) {
  return {
    baseline: baselineText.trim(),
    edited: editedText.trim(),
    changed: baselineText.trim() !== editedText.trim(),
  }
}

export function runLocalRevisionCheck({ text, scenario }: { text: string; scenario: ScenarioConfig }) {
  const lower = text.toLowerCase()
  const drugToken = scenario.drug.split(' ')[0].toLowerCase()
  const dxCode = scenario.diagnosis.match(/[A-Z]\d{2}(?:\.\d+)?/i)?.[0]?.toLowerCase()
  const dxPrefix = scenario.diagnosis.split(' ')[0].toLowerCase()
  const hasDrug = lower.includes(drugToken)
  const hasDiagnosis = (dxCode ? lower.includes(dxCode) : false) || lower.includes(dxPrefix)
  return { hasDrug, hasDiagnosis, passed: hasDrug && hasDiagnosis }
}
