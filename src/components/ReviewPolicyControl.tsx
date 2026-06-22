import { useState } from 'react'
import { ShoppingCart, ShieldCheck, Lock, Sliders, Send } from 'lucide-react'

// Auto-processing policy — the client self-serve control from the Telus-Kroll
// boundary. The client sets WHICH routine cases the system auto-assembles and
// queues, and how deeply to sample routine volume for human review. The system
// "builds the cart" (assembles the PA); a coordinator always does the "checkout"
// (the send). Nothing transmits to a payer without that human authorization.

const SAMPLE_OPTIONS = [
  { label: 'Review all', rate: 100 },
  { label: '1 in 5',     rate: 20 },
  { label: '1 in 10',    rate: 10 },
  { label: '1 in 20',    rate: 5 },
] as const

export function ReviewPolicyControl({ routineVolumePct, readOnly = false }: { routineVolumePct?: number; readOnly?: boolean }) {
  const [autoAssemble, setAutoAssemble] = useState(true)
  const [sampleRate, setSampleRate] = useState(20)

  const deepReviewPct = autoAssemble ? sampleRate : 100
  const fastSendPct = 100 - deepReviewPct

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Auto-Processing Policy</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border-emerald-500/20 whitespace-nowrap">
          Client self-serve
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        You decide which cases the system assembles and queues automatically — like setting reorder thresholds.
        The system fills the cart; a coordinator always checks out. <span className="text-slate-300">Nothing transmits to a payer
        without a human send.</span>
      </p>

      {/* Routine — the configurable, high-volume tier */}
      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-slate-200">Routine</span>
            {typeof routineVolumePct === 'number' && (
              <span className="text-xs text-slate-500">≈{routineVolumePct}% of volume</span>
            )}
          </div>
          <button
            onClick={() => !readOnly && setAutoAssemble(a => !a)}
            disabled={readOnly}
            role="switch"
            aria-checked={autoAssemble}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${autoAssemble ? 'bg-emerald-500' : 'bg-slate-700'} ${readOnly ? 'opacity-60 cursor-default' : ''}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoAssemble ? 'translate-x-4' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {autoAssemble
            ? 'Auto-assemble & queue — routine PAs are built by the system and land in the queue ready for a one-click send.'
            : 'Off — every routine PA is assembled but held for full human review before it can be sent.'}
        </p>

        {autoAssemble && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">Deep-review sample rate</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SAMPLE_OPTIONS.map(opt => (
                <button
                  key={opt.rate}
                  onClick={() => !readOnly && setSampleRate(opt.rate)}
                  disabled={readOnly}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sampleRate === opt.rate
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  } ${readOnly ? 'cursor-default' : sampleRate === opt.rate ? '' : 'hover:text-white hover:border-slate-600'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="text-emerald-300 font-medium">{deepReviewPct}%</span> of routine cases get full human review;
              the remaining <span className="text-slate-300 font-medium">{fastSendPct}%</span> are assembled and queued for one-click send —
              on-the-loop sampling keeps eyes on routine volume without re-reviewing every low-risk case.
            </p>
          </div>
        )}
      </div>

      {/* Complex & Exception — never auto, always human-owned */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm font-medium">Complex</span>
          </div>
          <p className="text-xs text-slate-500">Full human review — always. Multi-round and judgment-heavy cases can&rsquo;t be auto-sent.</p>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm font-medium">Exception</span>
          </div>
          <p className="text-xs text-slate-500">Human investigation — always. The AI escalates gaps instead of guessing.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-900/40 border border-slate-700/50 rounded-lg">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <Send className="w-3 h-3 inline -mt-0.5 mr-0.5 text-slate-400" />
          The system assembles every case (builds the cart). A coordinator always sends — automation governs assembly and
          review depth, never the human authorization to transmit.
        </p>
      </div>
    </div>
  )
}
