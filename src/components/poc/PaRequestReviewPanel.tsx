import { CheckCircle, Download, FileCheck2, Pencil } from 'lucide-react'
import { usePoc } from './PocContext'
import { CitationGroundTruth } from './CitationGroundTruth'
import { openPaRequestPdf, buildPaRequestNarrative } from './letter'

// Review surface for an INITIAL PA (lifecycle === 'initial_pa'). The artifact is a
// structured PA request — the completed DTR questionnaire plus the requested
// therapy — not a free-text appeal letter. Mirrors ReviewPanel's two-column
// layout and reuses the shared citation cross-highlight. The machine payload
// (FHIR/X12) lives in the case's Technical details, not here.
export function PaRequestReviewPanel() {
  const { scenario, setPhase, acknowledged, setAcknowledged, hoveredCite, setHoveredCite, editMode, setEditMode, editedBody, setEditedBody, letterDate } = usePoc()
  return (
    <div className="space-y-5">
      <div className="flex gap-6 items-start">
        {/* Left col: info bar + structured request */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-3 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl">
            <FileCheck2 className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-200">Review before filing this prior-authorization request</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {editMode
                  ? 'Editing the justification — changes save when you click Done editing'
                  : 'This is exactly what transmits to the payer over Da Vinci PAS — the completed questionnaire plus the FHIR (X12 278) bundle.'}
              </p>
            </div>
          </div>

          {/* Request document — white paper card */}
          <div className="paper bg-white rounded-xl overflow-hidden shadow-xl">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between gap-4">
              <span className="text-xs font-mono text-slate-400 truncate">
                Assembled by ClearAuth · {letterDate}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                {!editMode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    DRAFT — PENDING AUTHORIZATION
                  </span>
                )}
                <button
                  onClick={() => {
                    if (editMode) {
                      setEditMode(false)
                    } else {
                      setEditedBody(prev => prev ?? buildPaRequestNarrative(scenario))
                      setEditMode(true)
                      setAcknowledged(false)
                    }
                  }}
                  className="text-xs flex items-center gap-1 transition-colors text-blue-500 hover:text-blue-700"
                >
                  {editMode
                    ? <><CheckCircle className="w-3 h-3" />Done editing</>
                    : <><Pencil className="w-3 h-3" />Edit justification</>}
                </button>
                {!editMode && (
                  <button onClick={() => openPaRequestPdf(scenario)}
                    className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                    <Download className="w-3 h-3" />Save copy
                  </button>
                )}
              </div>
            </div>

            <div className="px-12 py-10 text-slate-900 text-sm leading-relaxed space-y-5">
              <h1 className="text-lg font-bold font-display">Prior Authorization Request</h1>

              {/* Fixed meta — always from data */}
              <div className="text-xs text-slate-600 border-b border-slate-200 pb-4 space-y-1">
                <p><strong>RE:</strong> New Prior Authorization Request — {scenario.drug}</p>
                <p><strong>To:</strong> Utilization Management, {scenario.plan}&nbsp;(Plan ID: {scenario.planId})</p>
                <p><strong>Diagnosis:</strong> {scenario.diagnosis}</p>
                <p><strong>Requested therapy:</strong> {scenario.requestedTherapy ?? scenario.drug}</p>
              </div>

              {/* CRD determination */}
              {scenario.paRequired && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">Coverage Requirements Discovery (CRD)</p>
                  <p className="text-xs text-slate-700">{scenario.paRequired.basis}</p>
                </div>
              )}

              {/* DTR questionnaire — one answer per criterion, each bound to a source */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                  Completed Documentation Questionnaire (DTR) — {scenario.configFile}
                </p>
                <div className="space-y-4">
                  {scenario.criteriaResults.map((cr, i) => {
                    const cite = scenario.citations[cr.rule.label]
                    const active = hoveredCite === i
                    return (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredCite(i)}
                        onMouseLeave={() => setHoveredCite(null)}
                        className={`pl-3 border-l-4 rounded-sm pr-2 py-1.5 transition-colors cursor-default ${
                          active ? 'border-emerald-500 bg-emerald-100' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-700">Q{i + 1}. {cr.rule.label}</p>
                        <p className="text-xs font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />Answer: Met
                        </p>
                        {cite && <p className="text-xs text-slate-400 mt-0.5">{cite.source} · {cite.page}</p>}
                        <p className="text-xs italic text-slate-600 mt-1">
                          &ldquo;{cite ? cite.text : 'Supporting documentation confirmed.'}&rdquo;
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              {editMode ? (
                <textarea
                  value={editedBody ?? ''}
                  onChange={e => setEditedBody(e.target.value)}
                  className="w-full min-h-40 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm leading-relaxed resize-y focus:outline-none focus:border-blue-400"
                />
              ) : editedBody ? (
                <p className="whitespace-pre-wrap">{editedBody}</p>
              ) : (
                <p>
                  We request prior authorization for <strong>{scenario.requestedTherapy ?? scenario.drug}</strong> for
                  the management of <strong>{scenario.diagnosis}</strong>. Every questionnaire answer above is supported
                  by documentation in the submitted record and is carried in the accompanying FHIR (X12&nbsp;278) bundle.
                </p>
              )}

              {/* Fixed footer — always from data */}
              <div className="text-xs text-slate-400 border-t border-slate-200 pt-4">
                Assembled via Universal Medical Ontology Pipeline · Config: {scenario.configFile} ·
                Files to the payer over HL7 FHIR Da Vinci PAS (X12 278).
              </div>
            </div>
          </div>
        </div>

        {/* Right col: citation ground truth panel (shared) */}
        <CitationGroundTruth />
      </div>

      {/* Acknowledgment gate */}
      <div className={`bg-slate-800/40 border rounded-xl p-4 transition-opacity ${editMode ? 'opacity-40 pointer-events-none' : 'border-slate-700'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            disabled={editMode}
            className="mt-0.5 w-4 h-4 accent-emerald-500 shrink-0"
          />
          <span className="text-sm text-slate-300 leading-relaxed">
            I have reviewed this prior-authorization request and confirm every questionnaire answer
            accurately represents the patient&rsquo;s clinical record and satisfies the payer&rsquo;s
            documentation requirements.
          </span>
        </label>
      </div>
      {editMode && (
        <p className="text-xs text-center text-amber-400">Click &ldquo;Done editing&rdquo; above before acknowledging</p>
      )}

      <div className="flex gap-3 pt-1 flex-wrap">
        <button
          onClick={() => setPhase('submitted')}
          disabled={!acknowledged || editMode}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          <CheckCircle className="w-4 h-4" />Confirm &amp; File PA Request
        </button>
        <button onClick={() => { setPhase('done'); setAcknowledged(false); setEditMode(false) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors">
          ← Back
        </button>
      </div>
    </div>
  )
}
