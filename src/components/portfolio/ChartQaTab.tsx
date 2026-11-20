import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { type Client, type ScenarioConfig, type SourceDocument } from '../../types'
import { CaseTimeline } from '../poc/CaseTimeline'
import { ActivityLog } from './ActivityLog'
import { type ActivityEntry, type LocalCaseState } from './caseQueue'
import { countDocumentsByCategory, type DocCategory, filterDocumentsByCategory } from './chartQaHelpers'
import { DocumentsVault } from './DocumentsVault'
import { FixtureChat } from './FixtureChat'

const CATEGORY_TABS: { key: DocCategory; label: string }[] = [
  { key: 'all', label: 'All Docs' },
  { key: 'clinical', label: 'Consults & Denials' },
  { key: 'labs_meds', label: 'Labs & Rx History' },
  { key: 'held', label: 'Held / Misfiled' },
]

function SessionAuditSummaryBar({ localState, heldCount }: { localState?: LocalCaseState; heldCount: number }) {
  const attachedCount = Object.values(localState?.attachedExcerpts ?? {}).flat().length
  const deltaCount = Object.keys(localState?.findingsDeltas ?? {}).length
  const revisionLabel = localState?.editedNarrative ? 'Rev 2 · Clinician Edit' : 'Rev 1 · AI Draft'
  const pills = [
    { label: 'Packet Revision', value: revisionLabel, cls: localState?.editedNarrative ? 'text-amber-300 border-amber-500/30 bg-amber-500/10' : 'text-slate-300 border-slate-700 bg-slate-900/50' },
    { label: 'Attached Excerpts', value: `${attachedCount}`, cls: attachedCount > 0 ? 'text-sky-300 border-sky-500/30 bg-sky-500/10' : 'text-slate-400 border-slate-700 bg-slate-900/50' },
    { label: 'Reassessed Deltas', value: `${deltaCount}`, cls: deltaCount > 0 ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700 bg-slate-900/50' },
    { label: 'Wrong-Patient Holds', value: `${heldCount}`, cls: heldCount > 0 ? 'text-red-300 border-red-500/30 bg-red-500/10' : 'text-slate-400 border-slate-700 bg-slate-900/50' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {pills.map(p => (
        <div key={p.label} className={`rounded-lg border px-3 py-2 ${p.cls}`}>
          <p className="text-[10px] uppercase tracking-wide opacity-80">{p.label}</p>
          <p className="text-xs font-semibold font-mono mt-0.5 truncate">{p.value}</p>
        </div>
      ))}
    </div>
  )
}

export function ChartQaTab({
  client, scenario, docs, qaSuggestions, activeDocId, onViewDoc, activity, localState,
}: {
  client: Client; scenario: ScenarioConfig; docs: SourceDocument[]; qaSuggestions: { q: string; a: string }[]
  activeDocId: string | null; onViewDoc: (docId: string) => void; activity: ActivityEntry[]; localState?: LocalCaseState
}) {
  const [category, setCategory] = useState<DocCategory>('all')
  const counts = countDocumentsByCategory(docs)
  const filteredDocs = filterDocumentsByCategory(docs, category)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">Grounded Chart Q&amp;A</span>
          <span className="ml-auto text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded px-2 py-0.5">
            {docs.length} Source Doc{docs.length !== 1 ? 's' : ''} Indexed
          </span>
        </div>
        <FixtureChat
          variant="compact"
          intro={`Chart context loaded for ${client.patientDisplayName ?? client.name} (${docs.length} source items). Pick a grounded prompt below.`}
          suggestions={qaSuggestions}
          deferralReply="Free-form chart Q&A queries run against the live EHR retrieval service (unit O6). Select a grounded prompt above or view documents directly."
          placeholder="Ask about prior trials, lab results, or criteria…"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_TABS.map(tab => {
            const active = category === tab.key
            return (
              <button
                key={tab.key} type="button" onClick={() => setCategory(tab.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label} ({counts[tab.key]})
              </button>
            )
          })}
        </div>
        <DocumentsVault documents={filteredDocs} activeDocId={activeDocId} onViewDoc={onViewDoc} />
      </div>

      {scenario.timeline && (
        <div className="pt-2 border-t border-slate-800/60 select-none">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Case Timeline</p>
          <CaseTimeline events={scenario.timeline} />
        </div>
      )}

      <SessionAuditSummaryBar localState={localState} heldCount={counts.held} />
      <ActivityLog entries={activity} />
    </div>
  )
}
