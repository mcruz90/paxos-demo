import { Eye } from 'lucide-react'
import { type SourceDocument } from '../../types'
import { presentationForSource } from './documentKindPresentation'

// The patient's case file: every source document indexed for this case, with
// its kind and provenance line. "View" opens the document in the right-pane
// SourceDocViewer. This is the browse-the-file surface; the viewer is the read
// surface. Mirrors the "Documents Vault" tab pattern.
export function DocumentsVault({
  documents,
  activeDocId,
  onViewDoc,
}: {
  documents: SourceDocument[]
  activeDocId: string | null
  onViewDoc: (docId: string) => void
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic text-center py-10">
        No documents indexed for this case yet.
      </p>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 select-none">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Patient Case File
        </p>
        <span className="text-xs text-slate-500">{documents.length} documents</span>
      </div>

      <div className="space-y-2">
        {documents.map(doc => {
          const { Icon, tone, chip, label } = presentationForSource(doc.source)
          const active = doc.id === activeDocId
          return (
            <div
              key={doc.id}
              className={[
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                active
                  ? 'bg-slate-800/60 border-slate-700'
                  : 'bg-slate-800/20 border-slate-800 hover:border-slate-700/60',
              ].join(' ')}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${tone}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-200 truncate">{doc.title}</p>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${chip}`}>
                    {label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{doc.meta}</p>
              </div>
              <button
                onClick={() => onViewDoc(doc.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                View
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
