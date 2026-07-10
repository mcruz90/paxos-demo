import { Package, ShieldCheck, TrendingUp, Stethoscope } from 'lucide-react'
import type { ScenarioConfig } from '../../types'
import { COVERAGE_RESOLUTION } from './coverage'
import { CaseTechnicalDetails } from './CaseTechnicalDetails'

/**
 * Right-column contextual sidebar for the submitted-with-payer-response state.
 * Replaces the generic drug/plan/coverage/tech-details stack with
 * decision-support information: drug + plan, compact coverage confirmation,
 * AI confidence indicator, and collapsible technical details.
 *
 * Sticky-positioned so it stays visible as the left-pane decision content scrolls.
 */
export function CaseContextSidebar({ scenario }: { scenario: ScenarioConfig }) {
  const cov = COVERAGE_RESOLUTION[scenario.id]
  const analysis = scenario.payerResponseAnalysis

  // Derive a confidence signal from the response type — static demo-quality
  // mapping.  A production system would compute this from historical outcomes.
  const confidence = analysis ? getConfidence(analysis.responseType) : null

  return (
    <div className="space-y-3">
      {/* ── Drug & Plan ─────────────────────────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-snug truncate">{scenario.drug}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{scenario.plan}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 px-3 py-2 bg-slate-900/40 rounded-lg">
          <Stethoscope className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">{scenario.diagnosis}</p>
        </div>
      </div>

      {/* ── Coverage (compact) ──────────────────────────────────────── */}
      {cov && (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Coverage</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border text-emerald-300 bg-emerald-500/10 border-emerald-500/20">
              Confirmed
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">BIN {cov.bin}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">PCN {cov.pcn}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400">GRP {cov.group}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            eff. {cov.effective} · {cov.channel}
          </p>
        </div>
      )}

      {/* ── AI Confidence ───────────────────────────────────────────── */}
      {confidence && (
        <div className={`rounded-xl p-4 border ${confidence.borderClass}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-4 h-4 ${confidence.iconClass}`} />
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">AI Assessment</p>
          </div>
          <p className={`text-lg font-bold ${confidence.textClass}`}>{confidence.label}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{confidence.rationale}</p>
        </div>
      )}

      {/* ── Criteria snapshot ───────────────────────────────────────── */}
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Criteria</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-300">{scenario.criteriaResults.filter(cr => cr.status === 'found').length} satisfied</span>
          </div>
          <span className="text-xs text-slate-500">{scenario.criteriaResults.length} total rules</span>
        </div>
      </div>

      {/* ── Technical details ───────────────────────────────────────── */}
      <CaseTechnicalDetails scenario={scenario} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confidence derivation — maps response type to a static signal.
// ---------------------------------------------------------------------------

function getConfidence(responseType: string) {
  switch (responseType) {
    case 'partial_approval':
      return {
        label: 'Dispute likely to succeed',
        rationale: 'Partial approvals with dosing below the drug label are frequently overturned on appeal — the labeled dose is strong clinical evidence.',
        borderClass: 'bg-emerald-950/30 border-emerald-500/20',
        textClass: 'text-emerald-400',
        iconClass: 'text-emerald-400',
      }
    case 'full_denial':
      return {
        label: 'Review clinical basis',
        rationale: 'Full denials require careful review of the payer\'s stated rationale against the documented clinical evidence before proceeding.',
        borderClass: 'bg-amber-950/30 border-amber-500/20',
        textClass: 'text-amber-400',
        iconClass: 'text-amber-400',
      }
    case 'info_request':
      return {
        label: 'Documentation needed',
        rationale: 'The payer has requested additional documentation. Gather the specified records before resubmitting.',
        borderClass: 'bg-sky-950/30 border-sky-500/20',
        textClass: 'text-sky-400',
        iconClass: 'text-sky-400',
      }
    default:
      return null
  }
}
