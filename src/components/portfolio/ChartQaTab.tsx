import { Sparkles } from 'lucide-react'
import { type Client, type ScenarioConfig, type SourceDocument } from '../../types'
import { CaseTimeline } from '../poc/CaseTimeline'
import { ActivityLog } from './ActivityLog'
import { type ActivityEntry } from './caseQueue'
import { DocumentsVault } from './DocumentsVault'
import { FixtureChat } from './FixtureChat'

export function ChartQaTab({
  client,
  scenario,
  docs,
  qaSuggestions,
  activeDocId,
  onViewDoc,
  activity,
}: {
  client: Client
  scenario: ScenarioConfig
  docs: SourceDocument[]
  qaSuggestions: { q: string; a: string }[]
  activeDocId: string | null
  onViewDoc: (docId: string) => void
  activity: ActivityEntry[]
}) {
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

      <DocumentsVault documents={docs} activeDocId={activeDocId} onViewDoc={onViewDoc} />

      {scenario.timeline && (
        <div className="pt-2 border-t border-slate-800/60 select-none">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Case Timeline</p>
          <CaseTimeline events={scenario.timeline} />
        </div>
      )}

      <ActivityLog entries={activity} />
      {activity.length === 0 && (
        <p className="text-xs text-slate-500 italic">
          No coordinator actions logged yet for this session. Exception resolutions and inline packet edits are listed here.
        </p>
      )}
    </div>
  )
}
