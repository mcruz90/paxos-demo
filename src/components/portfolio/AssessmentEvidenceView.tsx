import { AlertTriangle, FileText, MapPin } from 'lucide-react'
import type { AssessmentCitation, CaseAssessment } from '../../lib/wire'
import {
  type AssessmentSourceDoc,
  type DescribedCitation,
  buildAssessmentSourceDocs,
  findDocForCriterion,
  sliceByCodePoints,
} from './assessmentEvidence'

function SpanCard({ span, active }: { span: DescribedCitation; active: boolean }) {
  const tone = active
    ? 'border-emerald-500 bg-emerald-500/15 text-slate-100'
    : 'border-slate-800 bg-slate-950/60 text-slate-300'

  return (
    <div data-criterion-id={span.criterionId} className={`rounded-lg border p-3 space-y-1.5 ${tone}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="font-mono font-semibold text-slate-200">{span.criterionId}</span>
        <span className="font-mono text-slate-400">
          {span.start}..{span.end}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded border font-semibold ${
            span.role === 'context'
              ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
              : 'border-slate-700 bg-slate-900 text-slate-300'
          }`}
        >
          {span.roleLabel}
        </span>
      </div>
      {span.isLocationOnly ? (
        <p className="text-xs text-amber-300 italic flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          location only ({span.sourceVersionId} · offsets {span.start}..{span.end}) — no excerpt text
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-slate-200">&ldquo;{span.excerptText}&rdquo;</p>
      )}
    </div>
  )
}

function CanonicalBodyWithOffset({ doc, activeCriterionId }: { doc: AssessmentSourceDoc; activeCriterionId: string | null }) {
  if (!doc.canonicalBody) return null
  const activeSpan =
    (activeCriterionId && doc.spans.find(s => s.criterionId === activeCriterionId && !s.isLocationOnly)) ||
    doc.spans.find(s => !s.isLocationOnly)
  if (!activeSpan) return null
  const before = sliceByCodePoints(doc.canonicalBody, 0, activeSpan.start)
  const target = sliceByCodePoints(doc.canonicalBody, activeSpan.start, activeSpan.end)
  const after = sliceByCodePoints(doc.canonicalBody, activeSpan.end, Array.from(doc.canonicalBody).length)
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs font-mono leading-relaxed text-slate-400 whitespace-pre-wrap">
      <span>{before}</span>
      <mark className="bg-emerald-500/25 text-emerald-100 rounded px-0.5">{target}</mark>
      <span>{after}</span>
    </div>
  )
}

export function AssessmentEvidenceRailBody({
  assessment,
  activeCriterionId,
  activeSourceVersionId,
  sourceBodies,
}: {
  assessment: CaseAssessment
  activeCriterionId: string | null
  activeSourceVersionId: string | null
  sourceBodies?: Record<string, string>
}) {
  const docs = buildAssessmentSourceDocs(assessment, sourceBodies)
  const selectedDoc =
    (activeSourceVersionId && docs.find(d => d.sourceVersionId === activeSourceVersionId)) ||
    findDocForCriterion(docs, activeCriterionId)

  if (docs.length === 0) {
    return <p className="text-xs text-slate-500 italic p-4">No backend source citations in this assessment.</p>
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {selectedDoc && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs text-slate-300 border-b border-slate-800 pb-2">
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-mono font-semibold truncate">{selectedDoc.sourceVersionId}</span>
            <span className="ml-auto font-mono text-[10px] text-slate-500">sha256 {selectedDoc.shaShort}</span>
          </div>
          <CanonicalBodyWithOffset doc={selectedDoc} activeCriterionId={activeCriterionId} />
          <div className="space-y-2">
            {selectedDoc.spans.map((span, idx) => (
              <SpanCard key={`${span.criterionId}-${idx}`} span={span} active={span.criterionId === activeCriterionId} />
            ))}
          </div>
        </div>
      )}

      {docs.length > 1 && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">All cited source versions</p>
          {docs
            .filter(d => d.sourceVersionId !== selectedDoc?.sourceVersionId)
            .map(doc => (
              <div key={doc.sourceVersionId} className="space-y-1.5">
                <p className="text-[11px] font-mono text-slate-400">{doc.sourceVersionId}</p>
                {doc.spans.map((span, idx) => (
                  <SpanCard key={`${doc.sourceVersionId}-${idx}`} span={span} active={span.criterionId === activeCriterionId} />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export function ResolverAssessmentPanel({
  criterionId,
  isBlocker,
  backendNextAction,
  contextEvidence,
}: {
  criterionId?: string
  isBlocker?: boolean
  backendNextAction?: string | null
  contextEvidence?: AssessmentCitation[]
}) {
  if (!criterionId && !backendNextAction && (!contextEvidence || contextEvidence.length === 0)) {
    return null
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5 shrink-0">
      <div className="flex flex-wrap items-center gap-2">
        {criterionId && (
          <span className="text-[11px] font-mono font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded px-2 py-0.5">
            {criterionId}
          </span>
        )}
        {isBlocker && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-300 bg-red-500/15 border border-red-500/35 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> Blocker
          </span>
        )}
      </div>
      {backendNextAction && (
        <p className="text-xs text-amber-200 leading-relaxed">
          <span className="font-semibold text-amber-300">Next action:</span> {backendNextAction}
        </p>
      )}
      {contextEvidence && contextEvidence.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            Context only (not proof)
          </p>
          {contextEvidence.map((cite, idx) => (
            <div key={idx} className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-2.5 py-2 text-xs text-slate-300">
              <p className="text-[10px] font-mono text-slate-400">
                {cite.source_version_id} [{cite.start}..{cite.end})
              </p>
              <p className="mt-0.5">{cite.excerpt ?? 'location only — no text'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
