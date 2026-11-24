import { CheckCircle, Zap, ChevronRight, AlertTriangle, ArrowDown, FileText, Send } from 'lucide-react'
import { usePoc } from './PocContext'
import { TransmissionReceipt } from './Transmission'
import { CollapsibleSection } from './CollapsibleSection'
import { InlineProgress } from './InlineProgress'
import { OriginalSubmittedLayout } from './OriginalSubmittedLayout'

export function SubmittedPanel() {
  const { scenario } = usePoc()
  return scenario.payerCounterOffer ? <PayerResponseLayout /> : <OriginalSubmittedLayout />
}

function PayerResponseLayout() {
  const { scenario, onReset, appealRef, payerResponseResolution, setPayerResponseResolution, handleRound2Execute, round2Loading, round2StepIdx, pipelineSteps } = usePoc()
  const isInitialPa = scenario.lifecycle === 'initial_pa'
  const co = scenario.payerCounterOffer!
  const analysis = scenario.payerResponseAnalysis
  const r2 = scenario.round2Appeal

  return (
    <div className="space-y-4">
      <div id="tour-payer-response" className="bg-slate-800/30 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-950/40 border-b border-amber-500/20">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Payer Response — Action Required</p>
            <p className="text-xs text-amber-300/60 mt-0.5">{co.date} · {co.summary.split('.')[0]}</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-900/50 border border-slate-700/40 p-3">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide mb-1">Requested</p>
              <p className="text-lg font-bold text-white">56 days (20 mg once daily)</p>
              <p className="text-xs text-slate-400 mt-1">Prescribed 56-day course for child 23 kg (DOB 2019-01-15) with LA Grade B erosive esophagitis</p>
            </div>
            <div className="rounded-lg bg-amber-950/30 border border-amber-500/20 p-3">
              <p className="text-[11px] font-medium text-amber-400/70 uppercase tracking-wide mb-1">Approved</p>
              <p className="text-lg font-bold text-amber-300">28 of 56 days</p>
              <p className="text-xs text-amber-300/60 mt-1">{co.newDenialReason}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/20 border border-amber-500/10">
            <ArrowDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300/80">
              <span className="font-semibold">Duration capped at 28 of 56 days</span> — policy states authorization will be issued for 12 months; payer upheld 28 days on 2026-11-13 and offered a peer-to-peer review.
            </p>
          </div>

          {analysis && payerResponseResolution !== 'accepted' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-300">AI Analysis — {analysis.aiFlag}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{analysis.aiRationale}</p>
                </div>
              </div>

              {r2?.guidelineRef && (
                <div className="flex items-start gap-2 px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-700/30">
                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 leading-relaxed">{r2.guidelineRef}</p>
                    {r2.guidelinePMID && (
                      <a
                        href={`https://pubmed.ncbi.nlm.nih.gov/${r2.guidelinePMID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors mt-1 inline-block"
                      >
                        PMID {r2.guidelinePMID} ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {analysis && payerResponseResolution === 'accepted' && (
            <div className="flex items-center gap-3 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Partial Approval Accepted</p>
                <p className="text-xs text-emerald-300/70 mt-0.5">Case marked as resolved. The 28-day partial approval has been accepted as-is.</p>
              </div>
            </div>
          )}

          {round2Loading ? (
            <InlineProgress
              steps={pipelineSteps}
              currentStep={round2StepIdx}
              variant="violet"
              label="Counter-argument"
            />
          ) : analysis && payerResponseResolution !== 'accepted' ? (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPayerResponseResolution('accepted')}
                className="flex-1 px-3 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-medium transition-colors"
              >
                {analysis.ctaAccept}
              </button>
              <button
                id="tour-round2-execute"
                onClick={handleRound2Execute}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />{analysis.ctaDispute}
              </button>
            </div>
          ) : !analysis ? (
            <button id="tour-round2-execute" onClick={handleRound2Execute}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
              <Zap className="w-4 h-4" />Generate Round 2 Counter-Argument
            </button>
          ) : null}
        </div>
      </div>

      <CollapsibleSection
        title="Submission Record"
        icon={<CheckCircle className="w-4 h-4" />}
        badge={
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            {isInitialPa ? 'PA Filed' : 'Appeal Filed'}
          </span>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-emerald-300/70">
            {isInitialPa
              ? <>Filed to {scenario.plan} via Da Vinci PAS · {appealRef}</>
              : <>Transmitted to {scenario.plan} · {appealRef}</>}
          </p>
          <div className="space-y-1">
            {([
              { label: 'Drug',       value: scenario.drug },
              { label: 'Plan',       value: `${scenario.plan} (${scenario.planId})` },
              { label: 'Diagnosis',  value: scenario.diagnosis },
              { label: 'Reference',  value: appealRef },
              { label: 'Filed by',   value: 'PA Coordinator · ClearAuth Portal' },
              { label: 'Timestamp',  value: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) },
            ] as const).map(({ label, value }) => (
              <div key={label} className="flex items-start gap-3 text-xs">
                <span className="text-slate-600 w-24 shrink-0">{label}</span>
                <span className="text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Transmission Channel"
        icon={<Send className="w-4 h-4" />}
        badge={
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
            ePA · Da Vinci PAS
          </span>
        }
      >
        <TransmissionReceipt plan={scenario.plan} lifecycle={scenario.lifecycle} embedded />
      </CollapsibleSection>

      <div className="flex gap-3 pt-1">
        <button onClick={onReset}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors">
          <ChevronRight className="w-4 h-4" />Return to Case Queue
        </button>
      </div>
    </div>
  )
}
