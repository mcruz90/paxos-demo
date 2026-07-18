/**
 * Human-review surface for a parked exception-tier run (POST /api/appeal/resume).
 *
 * A reviewer approves the drafted letter as-is (edited_text=null →
 * provenance=human_approved) or replaces it with edited text (changed text →
 * provenance=human_edited; the backend treats draft-identical text as an
 * approval). The draft prefills the editor only when it was streamed this
 * session; the queue carries no letter text (PHI rule).
 */
import { useState } from 'react'
import { CheckCircle2, PencilLine } from 'lucide-react'

export function ResumeEditor({
  correlationId,
  draft,
  busy,
  error,
  onResume,
}: {
  correlationId: string
  draft: string
  busy: boolean
  /** A failed resume (error terminal / transport failure) keeps this panel open
   * with the reviewer's edits intact; this is the message shown to them. */
  error: string | null
  onResume: (editedText: string | null) => void
}) {
  const [mode, setMode] = useState<'as_is' | 'edit'>('as_is')
  const [text, setText] = useState(draft)

  return (
    <div className="bg-slate-800/40 border border-amber-700/40 rounded-xl p-5 space-y-4">
      <div>
        <p className="text-sm font-medium text-amber-400">Exception tier — human review required</p>
        <p className="text-xs text-slate-500 font-mono mt-0.5">{correlationId}</p>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setMode('as_is')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
            mode === 'as_is' ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-700 text-slate-400'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" /> Approve as-is
        </button>
        <button
          onClick={() => setMode('edit')}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-colors ${
            mode === 'edit' ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-700 text-slate-400'
          }`}
        >
          <PencilLine className="w-4 h-4" /> Edit letter
        </button>
      </div>

      {mode === 'edit' && (
        <textarea
          className="w-full h-48 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200 font-mono"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          Review not submitted: {error}. Your edits are kept — try again.
        </p>
      )}

      <button
        disabled={busy}
        onClick={() => onResume(mode === 'as_is' ? null : text)}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white transition-colors"
      >
        {busy ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  )
}
