import { useEffect, useState } from 'react'
import { type PatientContext, type ScenarioConfig } from '../../types'
import { buildVerificationStates, resolveLetterNarrative } from './letterNarrative'
import { BlockedDraftBanner, CitationPill, CitedCriterionRow, LetterVerificationBar } from './LetterPreviewParts'

function LetterHeaderBlock({ scenario, patientContext, dateStr, isInitial }: {
  scenario: ScenarioConfig; patientContext: PatientContext; dateStr: string; isInitial: boolean
}) {
  return (
    <div className="text-xs text-slate-500 font-sans border-b border-slate-200 pb-3 space-y-1">
      <p><strong>Date:</strong> {dateStr}</p>
      <p><strong>Insurance Plan:</strong> {scenario.plan} (Plan ID: {scenario.planId})</p>
      <p><strong>Diagnosis:</strong> {scenario.diagnosis}</p>
      <p><strong>{isInitial ? 'Requested Therapy:' : 'Appealed Therapy:'}</strong> {scenario.requestedTherapy || scenario.drug}</p>
      {!isInitial && <p><strong>Denial Reason:</strong> {scenario.denialReason}</p>}
      <div className="border-t border-dashed border-slate-200 my-2 pt-2">
        <p><strong>Patient:</strong> {patientContext.patientName} | <strong>DOB:</strong> {patientContext.patientDob} | <strong>Sex:</strong> {patientContext.patientSex}</p>
        <p><strong>Member ID:</strong> {patientContext.memberId} | <strong>Group:</strong> {patientContext.groupId}</p>
        <p><strong>Prescriber:</strong> {patientContext.prescriberName} (NPI: {patientContext.prescriberNpi})</p>
      </div>
    </div>
  )
}

function NarrativeSection({ mode, scenario, resolved, draftText, setDraftText, selectedCiteIndex, onSelectCiteIndex, onSave, onCancel }: {
  mode: 'verify' | 'edit'
  scenario: ScenarioConfig
  resolved: ReturnType<typeof resolveLetterNarrative>
  draftText: string
  setDraftText: (v: string) => void
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  onSave: () => void
  onCancel: () => void
}) {
  if (mode === 'edit') {
    return (
      <div className="space-y-2.5 font-sans">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Clinical Medical Necessity Narrative (Inline Editor)</label>
        <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={5} className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed" />
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={onSave} className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">Save Local Draft</button>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {resolved.source === 'unsaved_local_edit' && (
        <p className="font-sans text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 inline-block">
          Unsaved local draft — not validated against source citations
        </p>
      )}
      <p className="text-slate-700 leading-relaxed text-sm">
        {resolved.text}{' '}
        {resolved.source !== 'unsaved_local_edit' && scenario.criteriaResults.map((cr, idx) => {
          const cite = scenario.citations[cr.rule.label]
          return cite ? <CitationPill key={cr.rule.label} index={idx} source={cite.source} page={cite.page} active={selectedCiteIndex === idx} onSelect={() => onSelectCiteIndex(idx)} /> : null
        })}
      </p>
    </div>
  )
}

export function LetterPreview({
  scenario, patientContext, blocked, onGoToChecklist, selectedCiteIndex, onSelectCiteIndex, generatedLetter, gateResolution, editedNarrative, onSaveNarrative,
}: {
  scenario: ScenarioConfig; patientContext: PatientContext; blocked: boolean; onGoToChecklist: () => void
  selectedCiteIndex: number | null; onSelectCiteIndex: (idx: number | null) => void
  generatedLetter?: string; gateResolution?: string | null; editedNarrative?: string; onSaveNarrative?: (text: string) => void
}) {
  const [mode, setMode] = useState<'verify' | 'edit'>('verify')
  const isInitial = scenario.lifecycle === 'initial_pa'
  const resolved = resolveLetterNarrative({ scenario, generatedLetter, editedNarrative })
  const [draftText, setDraftText] = useState(resolved.text)

  useEffect(() => { setDraftText(resolved.text); setMode('verify') }, [scenario.id, resolved.text])

  const states = buildVerificationStates({ scenario, editedNarrative, gateResolution })
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const handleSaveEdits = () => { if (draftText.trim()) { onSaveNarrative?.(draftText.trim()); setMode('verify') } }

  return (
    <div className="space-y-3">
      {blocked && <BlockedDraftBanner onGoToChecklist={onGoToChecklist} />}
      <LetterVerificationBar states={states} isEdited={resolved.source === 'unsaved_local_edit'} mode={mode} onSetMode={m => { if (m === 'edit') setDraftText(resolved.text); setMode(m) }} />
      <div className="paper bg-white rounded-xl p-7 shadow-inner text-slate-800 font-serif text-sm leading-relaxed border border-slate-200">
        <div className="space-y-4 text-left select-text">
          <h1 className="text-lg font-bold font-sans text-slate-900">{isInitial ? 'Prior Authorization Request' : 'Prior Authorization Appeal Letter'}</h1>
          <LetterHeaderBlock scenario={scenario} patientContext={patientContext} dateStr={dateStr} isInitial={isInitial} />
          {!isInitial && <p className="mt-3">Dear Medical Director,</p>}
          <NarrativeSection mode={mode} scenario={scenario} resolved={resolved} draftText={draftText} setDraftText={setDraftText} selectedCiteIndex={selectedCiteIndex} onSelectCiteIndex={onSelectCiteIndex} onSave={handleSaveEdits} onCancel={() => setMode('verify')} />
          <div className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 mt-4 select-none">
            {isInitial ? 'Completed Questionnaire (DTR)' : 'Clinical Evidence & Grounded Criteria'}
          </div>
          <div className="space-y-3 mt-2">
            {scenario.criteriaResults.map((cr, i) => (
              <CitedCriterionRow key={i} index={i} scenario={scenario} heading={isInitial ? `Q${i + 1}: ${cr.rule.label}` : `${i + 1}. ${cr.rule.label}`} showAnswer={isInitial} active={selectedCiteIndex === i} onSelect={idx => onSelectCiteIndex(idx)} />
            ))}
          </div>
          {!isInitial && (
            <p>
              Based on the documented clinical evidence, we respectfully request that the prior authorization for <strong>{scenario.drug}</strong> be approved as medically necessary for <strong>{scenario.diagnosis}</strong>.
            </p>
          )}
          <div className="pt-2">
            <p>Sincerely,</p>
            <p className="font-bold text-slate-900 mt-1">ClearAuth, AI-Assisted Prior Authorization Team</p>
            <p className="text-slate-500 text-xs font-sans">Unsigned draft — requires named clinician approval before filing</p>
          </div>
          <div className="text-[11px] text-slate-400 border-t border-slate-200 pt-4 mt-6 font-sans select-none">
            Assembled via ClearAuth Clinical Ontology · {scenario.configFile} · Click any [Cite] badge to inspect the source chart span
          </div>
        </div>
      </div>
    </div>
  )
}
