import { Sparkles } from 'lucide-react'
import { type SourceDocument } from '../../types'
import { FixtureChat } from './FixtureChat'
import { type PatientProfileData } from './patient'
import { presentationForSource } from './documentKindPresentation'

// Document Vault & Q&A: the patient's indexed documents plus an AI auditor that
// answers from fixture-derived clinical/trial facts. Free-form questions defer
// to the live retrieval backend (O6) — the demo rail never improvises clinical
// answers.
export function PatientDocVault({
  documents,
  data,
  patientRef,
}: {
  documents: SourceDocument[]
  data?: PatientProfileData
  patientRef: string
}) {
  const suggestions = buildSuggestions(data)

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: indexed documents */}
      <div className="w-[46%] shrink-0 border-r border-slate-800 overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Indexed Documents</p>
          <span className="text-xs text-slate-500">{documents.length}</span>
        </div>
        {documents.length ? (
          <div className="space-y-2">
            {documents.map(doc => {
              const { Icon, tone, chip, label } = presentationForSource(doc.source)
              return (
                <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/30 px-3.5 py-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${tone}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{doc.title}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{doc.meta}</p>
                  </div>
                  <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border ${chip}`}>{label}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No documents indexed for this patient (demo).</p>
        )}
      </div>

      {/* Right: AI auditor */}
      <Auditor suggestions={suggestions} patientRef={patientRef} />
    </div>
  )
}

function Auditor({ suggestions, patientRef }: { suggestions: { q: string; a: string }[]; patientRef: string }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-slate-200">ClearAuth AI Auditor</span>
        <span className="ml-auto text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded px-1.5 py-0.5">
          Active Grounding
        </span>
      </div>
      <FixtureChat
        variant="full"
        intro={`I have audited this patient's de-identified clinical history (Ref: ${patientRef}). Ask me to cross-reference prior therapy trials, identify criteria discrepancies, or quote guideline outcomes.`}
        suggestions={suggestions}
        deferralReply="Free-form Q&A over the document corpus runs on the live retrieval backend (unit O6) — not on the demo rail. Try a suggested question."
        placeholder="Ask about compliance logs, clinical indices…"
      />
    </div>
  )
}

// Suggestions answer verbatim from fixture data — never invented.
function buildSuggestions(data?: PatientProfileData): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = []
  if (data?.trials?.length && data.compliance) {
    out.push({
      q: 'Verify prior therapy trial',
      a: `${data.trials.length} verified dispense records on file (e.g. ${data.trials[0].therapy}, ${data.trials[0].facility}); measured adherence (PDC) ${data.compliance.pdc} over ${data.compliance.durationDays} days.`,
    })
  }
  if (data?.clinical?.diagnoses.length) {
    const d = data.clinical.diagnoses[0]
    out.push({ q: 'Confirm primary diagnosis', a: `Primary diagnosis: ${d.label}${d.code ? ` (${d.code})` : ''}${d.since ? `, documented since ${d.since}` : ''}.` })
  }
  return out
}
