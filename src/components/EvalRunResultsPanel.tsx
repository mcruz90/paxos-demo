import { GitCommit, Layers } from 'lucide-react'
import {
  DEFAULT_EVAL_SNAPSHOT,
  type EvalSnapshot,
  NOT_IN_SNAPSHOT,
  formatShortCommit,
  formatSnapshotSourceNote,
} from '../data/evalSnapshot'
import { type CaseStatus } from '../types'
import { ClearauthEvalStagesCard } from './evals/ClearauthEvalStagesCard'
import { E2eChainCard } from './evals/E2eChainCard'
import { NotBuiltSnapshotCard } from './evals/NotBuiltSnapshotCard'
import { PairedPromptsAndClocksCard } from './evals/PairedPromptsAndClocksCard'
import { RedTeamSnapshotCard } from './evals/RedTeamSnapshotCard'

function HarnessSnapshotBlock({ snapshot }: { snapshot: EvalSnapshot | null }) {
  const sourceNote = formatSnapshotSourceNote(snapshot)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Harness Snapshot · Example from clearauth-eval PR #219</h2>
        </div>
        {snapshot ? (
          <span
            title={sourceNote}
            className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            <GitCommit className="w-3 h-3" />
            Example v{snapshot.schema_version} · {formatShortCommit(snapshot.as_of_commit)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full border border-slate-700 bg-slate-900/60 text-amber-300">
            {NOT_IN_SNAPSHOT}
          </span>
        )}
      </div>
      <ClearauthEvalStagesCard snapshot={snapshot} />
      <E2eChainCard snapshot={snapshot} />
      <PairedPromptsAndClocksCard snapshot={snapshot} />
    </div>
  )
}

export function EvalRunResultsPanel({
  snapshot = DEFAULT_EVAL_SNAPSHOT,
}: {
  onOpenCase?: (scenarioId: string, status: CaseStatus) => void
  snapshot?: EvalSnapshot | null
}) {
  return (
    <div className="space-y-6">
      <HarnessSnapshotBlock snapshot={snapshot} />
      <RedTeamSnapshotCard snapshot={snapshot} />
      <NotBuiltSnapshotCard
        snapshot={snapshot}
        itemId="runtime_cost"
        heading="Runtime · Estimated Model Routing & Cost per Case"
      />
      <NotBuiltSnapshotCard
        snapshot={snapshot}
        itemId="per_case_results"
        heading="Per-Case Matrix & Per-Case Scores"
      />
    </div>
  )
}
