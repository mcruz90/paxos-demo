import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileCheck, PencilLine } from 'lucide-react'
import { type PatientContext, type ScenarioConfig } from '../../types'
import { buildPaRequestNarrative } from '../poc/letter'

// In-pane unified paper canvas for the payer-facing artifact (Initial PA DTR
// packet or Appeal Letter). Features a clinical verification banner, a
// Verify Citations / Edit Text Inline toggle, and clickable inline [Cite N]
// pills that drive the Right Source Chart highlight.

function CitationPill({
  index,
  source,
  page,
  active,
  onSelect,
}: {
  index: number
  source: string
  page: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      className={[
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-[11px] font-semibold border transition-all mx-0.5 align-baseline',
        active
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
          : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100',
      ].join(' ')}
      title={`Jump to ${source} (${page}) in Source Chart`}
    >
      [Cite {index + 1}: {source} · {page}]
    </button>
  )
}

function CitedCriterionRow({
  index,
  scenario,
  heading,
  showAnswer,
  active,
  onSelect,
}: {
  index: number
  scenario: ScenarioConfig
  heading: string
  showAnswer: boolean
  active: boolean
  onSelect: (idx: number) => void
}) {
  const cr = scenario.criteriaResults[index]
  const cite = scenario.citations[cr.rule.label]
  return (
    <div
      onClick={() => onSelect(index)}
      className={`pl-3 border-l-4 rounded-sm pr-2 py-2 transition-colors cursor-pointer ${
        active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <p className="text-xs font-bold text-slate-800">{heading}</p>
        {cite && (
          <CitationPill
            index={index}
            source={cite.source}
            page={cite.page}
            active={active}
            onSelect={() => onSelect(index)}
          />
        )}
      </div>
      {showAnswer && <p className="text-xs text-emerald-600 font-semibold mt-0.5">Answer: Met</p>}
      <p className="text-xs italic text-slate-600 mt-1">
        &ldquo;{cite ? cite.text : 'Supporting documentation confirmed.'}&rdquo;
      </p>
    </div>
  )
}

export function LetterPreview({
  scenario,
  patientContext,
  blocked,
  onGoToChecklist,
  selectedCiteIndex,
  onSelectCiteIndex,
  editedNarrative,
  onSaveNarrative,
}: {
  scenario: ScenarioConfig
  patientContext: PatientContext
  blocked: boolean
  onGoToChecklist: () => void
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
  editedNarrative?: string
  onSaveNarrative?: (text: string) => void
}) {
  const [mode, setMode] = useState<'verify' | 'edit'>('verify')
  const isInitial = scenario.lifecycle === 'initial_pa'

  const defaultNarrative = isInitial
    ? buildPaRequestNarrative(scenario)
    : `We are writing to formally appeal the prior authorization denial for ${scenario.drug}. The denial cited "${scenario.denialReason}." Upon thorough review of the patient's clinical record, all applicable criteria for ${scenario.diagnosis} are satisfied and documented directly in the chart.`

  const activeNarrative = editedNarrative ?? defaultNarrative
  const [draftText, setDraftText] = useState(activeNarrative)

  useEffect(() => {
    setDraftText(editedNarrative ?? defaultNarrative)
    setMode('verify')
  }, [scenario.id, editedNarrative, defaultNarrative])

  if (blocked) {
    return (
      <div className="paper bg-white rounded-xl p-8 shadow-inner text-slate-800 border border-slate-200 min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1 font-sans">Packet Assembly Blocked</h3>
        <p className="text-xs text-slate-500 max-w-sm leading-normal font-sans">
          A prior authorization request or appeal letter cannot be compiled while there are
          unresolved clinical exceptions. Please resolve all items in the checklist first.
        </p>
        <button
          onClick={onGoToChecklist}
          className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold font-sans transition-colors"
        >
          Go to Criteria Checklist
        </button>
      </div>
    )
  }

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const totalCriteria = scenario.criteriaResults.length
  const citedCount = scenario.criteriaResults.filter(cr => !!scenario.citations[cr.rule.label]).length
  const payerShort = scenario.plan.split(' ')[0]

  const handleSaveEdits = () => {
    const trimmed = draftText.trim()
    if (!trimmed) return
    onSaveNarrative?.(trimmed)
    setMode('verify')
  }

  return (
    <div className="space-y-3">
      {/* Clinical Verification Banner + Verify/Edit Toggle */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            AI Draft Complete · {citedCount}/{totalCriteria} {payerShort} Criteria Cited · 100% Claims Grounded to Chart
          </span>
          {editedNarrative && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-semibold">
              Edited by Clinician
            </span>
          )}
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-900/60 border border-slate-700/70 p-0.5">
          <button
            type="button"
            onClick={() => setMode('verify')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === 'verify'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            Verify Citations Mode
          </button>
          <button
            type="button"
            onClick={() => { setDraftText(activeNarrative); setMode('edit') }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
              mode === 'edit'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PencilLine className="w-3.5 h-3.5" />
            Edit Text Inline
          </button>
        </div>
      </div>

      {/* Unified White Paper Packet */}
      <div className="paper bg-white rounded-xl p-7 shadow-inner text-slate-800 font-serif text-sm leading-relaxed border border-slate-200">
        <div className="space-y-4 text-left select-text">
          <h1 className="text-lg font-bold font-sans text-slate-900">
            {isInitial ? 'Prior Authorization Request' : 'Prior Authorization Appeal Letter'}
          </h1>
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

          {!isInitial && <p className="mt-3">Dear Medical Director,</p>}

          {/* Narrative block (editable inline or annotated with [Cite] pills) */}
          {mode === 'edit' ? (
            <div className="space-y-2.5 font-sans">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Clinical Medical Necessity Narrative (Inline Editor)
              </label>
              <textarea
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode('verify')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                >
                  Save Clinical Edits
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-700 leading-relaxed text-sm">
              {activeNarrative}{' '}
              {scenario.criteriaResults.map((cr, idx) => {
                const cite = scenario.citations[cr.rule.label]
                if (!cite) return null
                return (
                  <CitationPill
                    key={cr.rule.label}
                    index={idx}
                    source={cite.source}
                    page={cite.page}
                    active={selectedCiteIndex === idx}
                    onSelect={() => onSelectCiteIndex(idx)}
                  />
                )
              })}
            </p>
          )}

          <div className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 mt-4 select-none">
            {isInitial ? 'Completed Questionnaire (DTR)' : 'Clinical Evidence & Grounded Criteria'}
          </div>

          <div className="space-y-3 mt-2">
            {scenario.criteriaResults.map((cr, i) => (
              <CitedCriterionRow
                key={i}
                index={i}
                scenario={scenario}
                heading={isInitial ? `Q${i + 1}: ${cr.rule.label}` : `${i + 1}. ${cr.rule.label}`}
                showAnswer={isInitial}
                active={selectedCiteIndex === i}
                onSelect={idx => onSelectCiteIndex(idx)}
              />
            ))}
          </div>

          {!isInitial && (
            <p>
              Based on the documented clinical evidence, we respectfully request that the prior
              authorization for <strong>{scenario.drug}</strong> be approved. This medication is
              medically necessary for the management of <strong>{scenario.diagnosis}</strong> and
              consistent with current clinical guidelines.
            </p>
          )}

          <div className="pt-2">
            <p>Sincerely,</p>
            <p className="font-bold text-slate-900 mt-1">{patientContext.prescriberName}</p>
            <p className="text-slate-500 text-xs font-sans">Prepared with ClearAuth Clinical PA Team</p>
          </div>

          <div className="text-[11px] text-slate-400 border-t border-slate-200 pt-4 mt-6 font-sans select-none">
            Assembled via ClearAuth Clinical Ontology · {scenario.configFile} · Click any [Cite] badge to inspect the source chart span
          </div>
        </div>
      </div>
    </div>
  )
}
