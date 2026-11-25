import { AlertTriangle, Eye, FileText, Loader2, Paperclip, Search, Trash2, X } from 'lucide-react'
import type { CaseAttachment, DiscoveryItem, DiscoveryResults } from '../../lib/wire'
import { formatAttachmentSpan, inspectDiscoveryItem } from './caseDiscovery'

export interface CaseDiscoveryRailProps {
  queryInput: string
  setQueryInput: (q: string) => void
  results: DiscoveryResults | null
  attachments: CaseAttachment[]
  attachmentsError: string | null
  discoveryError: string | null
  actionError: string | null
  isSearching: boolean
  isLoadingAttachments: boolean
  busyActionKey: string | null
  inspectedItem: DiscoveryItem | null
  onInspectItem: (item: DiscoveryItem | null) => void
  onSearch: (query?: string) => Promise<void>
  onAttach: (item: DiscoveryItem) => Promise<void>
  onRemove: (attachment: CaseAttachment) => Promise<void>
  staleQuery?: boolean
}

function InspectedSpanCard({
  item,
  sourceBodies,
  onClose,
}: {
  item: DiscoveryItem
  sourceBodies?: Record<string, string>
  onClose: () => void
}) {
  const inspected = inspectDiscoveryItem(item, sourceBodies)
  return (
    <div className="rounded-xl border border-emerald-500/40 bg-slate-950/80 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-100 truncate">{item.title}</p>
          <p className="text-[10px] font-mono text-slate-400 truncate">
            {item.source_id} · {item.source_version_id} · {item.category}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspected span"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {inspected.isMetadataOnly ? (
        <p className="text-xs text-amber-300 italic">{inspected.statusText}</p>
      ) : (
        <>
          <p className="text-[10px] font-mono text-slate-500">
            span [{inspected.start}..{inspected.end}) · sha256 {inspected.contentSha256.slice(0, 12)}
          </p>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-xs font-mono leading-relaxed text-slate-300 whitespace-pre-wrap">
            <span>{inspected.before}</span>
            <mark className="bg-emerald-500/25 text-emerald-100 rounded px-0.5">{inspected.highlight}</mark>
            <span>{inspected.after}</span>
          </div>
        </>
      )}
    </div>
  )
}

function DiscoveryResultCard({
  item, isAttached, isBusy, staleQuery, onInspect, onAttach,
}: {
  item: DiscoveryItem; isAttached: boolean; isBusy: boolean; staleQuery?: boolean; onInspect: () => void; onAttach: () => void
}) {
  const isMeta = item.availability === 'metadata_only'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-200 leading-snug">{item.title}</p>
        <span
          className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            isMeta ? 'border-amber-500/35 bg-amber-500/10 text-amber-300' : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {isMeta ? 'metadata only: not read' : 'full_text'}
        </span>
      </div>
      <p className="text-[10px] font-mono text-slate-400">
        {item.source_id} · {item.category} · {item.source_version_id}
      </p>
      {isMeta ? (
        <p className="text-[11px] text-amber-300 italic">metadata only: not read</p>
      ) : (
        <p data-testid="discovery-result-excerpt" className="text-[11px] text-slate-400 line-clamp-2">&ldquo;{item.excerpt}&rdquo;</p>
      )}
      <div className="flex items-center gap-2 pt-1">
        {!isMeta && (
          <button
            type="button"
            onClick={onInspect}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-[11px] text-slate-300 hover:border-slate-500"
          >
            <Eye className="w-3 h-3" /> Inspect
          </button>
        )}
        <button
          type="button"
          onClick={onAttach}
          disabled={isBusy || isAttached || !!staleQuery}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-45"
        >
          <Paperclip className="w-3 h-3" /> {isAttached ? 'Attached' : isBusy ? 'Attaching…' : 'Attach'}
        </button>
      </div>
    </div>
  )
}

function AttachmentRow({
  attachment, isRemoving, onInspect, onRemove,
}: {
  attachment: CaseAttachment; isRemoving: boolean; onInspect: () => void; onRemove: () => void
}) {
  const isMeta = attachment.item.availability === 'metadata_only'
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">{attachment.item.title}</p>
          <p className="text-[10px] font-mono text-slate-400 truncate">
            {attachment.item.source_id} · {attachment.item.source_version_id}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          aria-label={`Remove ${attachment.item.title}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-500/35 bg-red-500/10 text-[11px] text-red-300 hover:bg-red-500/20 disabled:opacity-45 shrink-0"
        >
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>
      <p className={`text-[11px] font-mono ${isMeta ? 'text-amber-300 italic' : 'text-slate-300'}`}>
        {formatAttachmentSpan(attachment.item)}
      </p>
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="truncate">{attachment.actor_id} · {attachment.attached_at}</span>
        {!isMeta && (
          <button type="button" onClick={onInspect} className="text-emerald-400 hover:underline shrink-0">
            Inspect
          </button>
        )}
      </div>
    </div>
  )
}

function DiscoveryResultsSection({
  discovery, attachedIds,
}: {
  discovery: CaseDiscoveryRailProps; attachedIds: Set<string>
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Discovery Results
      </p>
      {!discovery.results || discovery.staleQuery ? (
        <p className="text-xs text-slate-400 italic">
          No active search results in this view — run the search again to discover sources.
        </p>
      ) : discovery.results.items.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No sources matched this query.</p>
      ) : (
        <div className="space-y-2">
          {discovery.results.items.map(item => (
            <DiscoveryResultCard
              key={item.result_id}
              item={item}
              isAttached={attachedIds.has(item.result_id)}
              isBusy={discovery.busyActionKey === `attach:${item.result_id}`}
              staleQuery={discovery.staleQuery}
              onInspect={() => discovery.onInspectItem(item)}
              onAttach={() => void discovery.onAttach(item)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AttachedEvidenceList({
  discovery,
}: {
  discovery: CaseDiscoveryRailProps
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-slate-800">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Attached Evidence {!discovery.attachmentsError && `(${discovery.attachments.length})`}
      </p>
      {discovery.attachmentsError ? (
        <div className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {discovery.attachmentsError}
        </div>
      ) : discovery.isLoadingAttachments ? (
        <p className="text-xs text-slate-500 italic">Loading attachments…</p>
      ) : discovery.attachments.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No evidence attached to this case yet.</p>
      ) : (
        <div className="space-y-2">
          {discovery.attachments.map(att => (
            <AttachmentRow
              key={att.attachment_id}
              attachment={att}
              isRemoving={discovery.busyActionKey === `remove:${att.attachment_id}`}
              onInspect={() => discovery.onInspectItem(att.item)}
              onRemove={() => void discovery.onRemove(att)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DiscoveryEvidencePanel({
  discovery,
  sourceBodies,
}: {
  discovery: CaseDiscoveryRailProps
  sourceBodies?: Record<string, string>
}) {
  const attachedIds = new Set(discovery.attachments.map(a => a.item.result_id))
  const errors = [discovery.actionError, discovery.discoveryError].filter((e): e is string => !!e)

  return (
    <div className="h-full overflow-y-auto p-3.5 space-y-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
        Reassessment is not built yet — attaching or removing evidence does not change criteria, blockers, or readiness.
      </div>
      <form
        onSubmit={e => { e.preventDefault(); void discovery.onSearch(discovery.queryInput) }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          aria-label="Discovery query"
          value={discovery.queryInput}
          onChange={e => discovery.setQueryInput(e.target.value)}
          placeholder="Search clinical notes or index…"
          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={discovery.isSearching}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white shrink-0"
        >
          {discovery.isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Find evidence
        </button>
      </form>
      {errors.map((err, idx) => (
        <div key={idx} className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{err}</span>
        </div>
      ))}
      {discovery.inspectedItem && (
        <InspectedSpanCard item={discovery.inspectedItem} sourceBodies={sourceBodies} onClose={() => discovery.onInspectItem(null)} />
      )}
      <DiscoveryResultsSection discovery={discovery} attachedIds={attachedIds} />
      <AttachedEvidenceList discovery={discovery} />
    </div>
  )
}
