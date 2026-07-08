import { AlertTriangle } from 'lucide-react'
import { type PatientContext, type ScenarioConfig } from '../../types'
import { buildPaRequestNarrative } from '../poc/letter'

// In-pane preview of the payer-facing artifact: the structured PA request
// (initial-PA lifecycle) or the appeal letter. Hovering an evidence row
// highlights its citation in the CitationPane.

function CitedCriterionRow({
  index,
  scenario,
  heading,
  showAnswer,
  active,
  onHover,
}: {
  index: number
  scenario: ScenarioConfig
  heading: string
  showAnswer: boolean
  active: boolean
  onHover: (idx: number | null) => void
}) {
  const cr = scenario.criteriaResults[index]
  const cite = scenario.citations[cr.rule.label]
  return (
    <div
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      className={`pl-3 border-l-4 rounded-sm pr-2 py-2 transition-colors cursor-default ${
        active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-300'
      }`}
    >
      <p className="text-xs font-bold text-slate-800">{heading}</p>
      {showAnswer && <p className="text-xs text-emerald-600 font-semibold mt-0.5">Answer: Met</p>}
      {cite && <p className="text-[11px] text-slate-400 mt-0.5">{cite.source} · {cite.page}</p>}
      <p className="text-xs italic text-slate-600 mt-1">
        &ldquo;{cite ? cite.text : 'Supporting documentation confirmed.'}&rdquo;
      </p>
    </div>
  )
}

function PaRequestLetter({
  scenario,
  patientContext,
  dateStr,
  selectedCiteIndex,
  onSelectCiteIndex,
}: {
  scenario: ScenarioConfig
  patientContext: PatientContext
  dateStr: string
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
}) {
  return (
    <div className="space-y-4 text-left select-text">
      <h1 className="text-lg font-bold font-sans text-slate-900">Prior Authorization Request</h1>
      <div className="text-xs text-slate-500 font-sans border-b border-slate-200 pb-3 space-y-1">
        <p><strong>Date:</strong> {dateStr}</p>
        <p><strong>Insurance Plan:</strong> {scenario.plan} (ID: {scenario.planId})</p>
        <p><strong>Diagnosis:</strong> {scenario.diagnosis}</p>
        <p><strong>Requested Therapy:</strong> {scenario.requestedTherapy || scenario.drug}</p>
        <div className="border-t border-dashed border-slate-200 my-2 pt-2">
          <p><strong>Patient:</strong> {patientContext.patientName} | <strong>DOB:</strong> {patientContext.patientDob} | <strong>Sex:</strong> {patientContext.patientSex}</p>
          <p><strong>Member ID:</strong> {patientContext.memberId} | <strong>Group:</strong> {patientContext.groupId}</p>
          <p><strong>Prescriber:</strong> {patientContext.prescriberName} (NPI: {patientContext.prescriberNpi})</p>
        </div>
      </div>

      <div className="font-sans text-xs font-bold uppercase tracking-wider text-slate-400 mt-4 select-none">
        Completed Questionnaire (DTR)
      </div>

      <div className="space-y-3 mt-2">
        {scenario.criteriaResults.map((cr, i) => (
          <CitedCriterionRow
            key={i}
            index={i}
            scenario={scenario}
            heading={`Q${i + 1}: ${cr.rule.label}`}
            showAnswer
            active={selectedCiteIndex === i}
            onHover={onSelectCiteIndex}
          />
        ))}
      </div>

      <div className="border-t border-slate-200 pt-4 mt-4">
        <p className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400 mb-2 select-none">
          Summary Narrative
        </p>
        <p className="text-slate-700 leading-relaxed text-sm">
          {buildPaRequestNarrative(scenario)}
        </p>
      </div>

      <div className="text-[11px] text-slate-400 border-t border-slate-200 pt-4 mt-6 font-sans select-none">
        Assembled via Universal Medical Ontology Pipeline · Config: {scenario.configFile}
      </div>
    </div>
  )
}

function AppealLetter({
  scenario,
  patientContext,
  dateStr,
  selectedCiteIndex,
  onSelectCiteIndex,
}: {
  scenario: ScenarioConfig
  patientContext: PatientContext
  dateStr: string
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
}) {
  return (
    <div className="space-y-4 text-left select-text">
      <h1 className="text-lg font-bold font-sans text-slate-900">Prior Authorization Appeal Letter</h1>
      <div className="text-xs text-slate-500 font-sans border-b border-slate-200 pb-3 space-y-1">
        <p><strong>Date:</strong> {dateStr}</p>
        <p><strong>RE:</strong> Appeal of Prior Authorization Denial — {scenario.drug}</p>
        <p><strong>To:</strong> Medical Director, {scenario.plan} (Plan ID: {scenario.planId})</p>
        <p><strong>Denial Reason:</strong> {scenario.denialReason}</p>
        <div className="border-t border-dashed border-slate-200 my-2 pt-2">
          <p><strong>Patient:</strong> {patientContext.patientName} | <strong>DOB:</strong> {patientContext.patientDob}</p>
          <p><strong>Member ID:</strong> {patientContext.memberId} | <strong>Group:</strong> {patientContext.groupId}</p>
        </div>
      </div>

      <p className="mt-4">Dear Medical Director,</p>
      <p>
        We are writing to formally appeal the prior authorization denial for{' '}
        <strong>{scenario.drug}</strong>. The denial cited &ldquo;{scenario.denialReason}.&rdquo; Upon
        thorough review of the patient&rsquo;s clinical record, we submit that all applicable
        criteria for <strong>{scenario.diagnosis}</strong> have been satisfied, as documented below.
      </p>

      <div>
        <p className="text-xs font-sans font-bold uppercase tracking-wider text-slate-400 mb-3 select-none">
          Clinical Evidence — {scenario.configFile}
        </p>
        <div className="space-y-3">
          {scenario.criteriaResults.map((cr, i) => (
            <CitedCriterionRow
              key={i}
              index={i}
              scenario={scenario}
              heading={`${i + 1}. ${cr.rule.label}`}
              showAnswer={false}
              active={selectedCiteIndex === i}
              onHover={onSelectCiteIndex}
            />
          ))}
        </div>
      </div>

      <p>
        Based on the documented clinical evidence, we respectfully request that the prior
        authorization for <strong>{scenario.drug}</strong> be approved. This medication is
        medically necessary for the management of <strong>{scenario.diagnosis}</strong> and
        consistent with current clinical guidelines.
      </p>

      <div className="pt-2">
        <p>Sincerely,</p>
        <p className="font-bold text-slate-900 mt-1">ClearAuth</p>
        <p className="text-slate-500 text-xs font-sans">AI-Assisted Prior Authorization Team</p>
      </div>

      <div className="text-[11px] text-slate-400 border-t border-slate-200 pt-4 mt-6 font-sans select-none">
        Generated via Universal Medical Ontology Pipeline · Config: {scenario.configFile}
      </div>
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
}: {
  scenario: ScenarioConfig
  patientContext: PatientContext
  blocked: boolean
  onGoToChecklist: () => void
  selectedCiteIndex: number | null
  onSelectCiteIndex: (idx: number | null) => void
}) {
  if (blocked) {
    return (
      <div className="paper bg-white rounded-xl p-8 shadow-inner text-slate-800 border border-slate-200 min-h-[300px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1 font-sans">Letter Generation Blocked</h3>
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
  const letterProps = { scenario, patientContext, dateStr, selectedCiteIndex, onSelectCiteIndex }

  return (
    <div className="paper bg-white rounded-xl p-8 shadow-inner text-slate-800 font-serif text-sm leading-relaxed border border-slate-200">
      {scenario.lifecycle === 'initial_pa'
        ? <PaRequestLetter {...letterProps} />
        : <AppealLetter {...letterProps} />}
    </div>
  )
}
