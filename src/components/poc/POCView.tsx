import { useState, useEffect, useRef, useMemo } from 'react'
import { Package, ChevronLeft } from 'lucide-react'
import type { CaseStatus, ScenarioConfig, SimPhase } from '../../types'
import { initialClients, newCaseRef } from '../../data/scenarios'
import { getPipelineSteps } from './pipeline'
import { CaseTimeline } from './CaseTimeline'
import { CoverageResolutionLine } from './coverage'
import { CaseTechnicalDetails } from './CaseTechnicalDetails'
import { buildLetterBody, openAppealPdf } from './letter'
import { PocProvider, type PocContextValue } from './PocContext'
import { ReviewPanel } from './ReviewPanel'
import { PaRequestReviewPanel } from './PaRequestReviewPanel'
import { SubmittedPanel } from './SubmittedPanel'
import { Round2LoadingPanel } from './Round2LoadingPanel'
import { Round2DonePanel } from './Round2DonePanel'
import { Round2SubmittedPanel } from './Round2SubmittedPanel'
import { ExceptionsPanel } from './ExceptionsPanel'
import { DonePanel } from './DonePanel'
import { PipelineStartPanel } from './PipelineStartPanel'

export function POCView({ scenario, onReset, onSaveToPortfolio, reviewMode, autoStart, caseStatus, onStartAppeal }: {
  scenario: ScenarioConfig
  onReset: () => void
  onSaveToPortfolio?: () => void
  reviewMode?: boolean
  autoStart?: boolean
  caseStatus?: CaseStatus
  onStartAppeal?: (scenarioId: string) => void
}) {
  const [phase, setPhase] = useState<SimPhase>(
    reviewMode && (caseStatus === 'submitted' || caseStatus === 'payer_response') ? 'submitted' :
    reviewMode ? 'done' :
    'idle'
  )
  const [dispatched, setDispatched] = useState<string[]>([])
  const [pendingDispatch, setPendingDispatch] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [appealRef] = useState(() => {
    // Tie the submission reference to the case identity when it's a known case,
    // so the audit trail's reference matches the queue's case number.
    const known = initialClients.find(c => c.scenarioId === scenario.id)?.name
    return known ? known.replace('Case #', '') : newCaseRef()
  })
  const executeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const round2IntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const [traceOpen, setTraceOpen] = useState(true)
  const [hoveredCite, setHoveredCite] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedBody, setEditedBody] = useState<string | null>(null)
  const [round2StepIdx, setRound2StepIdx] = useState(0)
  const [tourIdx, setTourIdx] = useState(0)
  const [round2TourIdx, setRound2TourIdx] = useState(0)
  const [payerResponseResolution, setPayerResponseResolution] = useState<'accepted' | null>(null)

  const isInitialPa = scenario.lifecycle === 'initial_pa'

  const letterDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const generateLetterBody = (): string => buildLetterBody(scenario)

  const pipelineSteps = getPipelineSteps(scenario)

  const handleRound2Execute = () => {
    setPhase('round2_loading'); setRound2StepIdx(0); setRound2TourIdx(0)
    let i = 0
    round2IntervalRef.current = setInterval(() => {
      i++; setRound2StepIdx(i)
      if (i >= pipelineSteps.length - 1) {
        clearInterval(round2IntervalRef.current!)
        round2IntervalRef.current = null
      }
    }, 2500)
  }

  const [overrides, setOverrides] = useState<Record<string, string>>({}) // ruleLabel -> coordinator rationale
  const [pendingOverride, setPendingOverride] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState('')

  const unresolvedCriteria = scenario.criteriaResults.filter(cr => cr.status === 'needs_review' || cr.status === 'conflict')
  const satisfiedCriteria = scenario.criteriaResults.filter(cr => cr.status === 'found')
  const hasExceptions = unresolvedCriteria.length > 0
  const allResolved = unresolvedCriteria.length > 0 &&
    unresolvedCriteria.every(cr => dispatched.includes(cr.rule.label) || overrides[cr.rule.label])

  const dispatchWorkflow = (ruleLabel: string) => setDispatched(prev => [...prev, ruleLabel])
  const stagePendingDispatch = (ruleLabel: string) => setPendingDispatch(prev => [...prev, ruleLabel])
  const cancelPendingDispatch = (ruleLabel: string) => setPendingDispatch(prev => prev.filter(l => l !== ruleLabel))
  const confirmDispatch = (ruleLabel: string) => {
    dispatchWorkflow(ruleLabel)
    cancelPendingDispatch(ruleLabel)
  }
  const dispatchAll = () => {
    const remaining = unresolvedCriteria
      .filter(cr => !dispatched.includes(cr.rule.label) && !overrides[cr.rule.label])
    setPendingDispatch(prev => [...new Set([...prev, ...remaining.map(cr => cr.rule.label)])])
  }
  const applyOverride = (ruleLabel: string) => {
    if (!overrideInput.trim()) return
    setOverrides(prev => ({ ...prev, [ruleLabel]: overrideInput.trim() }))
    setPendingOverride(null)
    setOverrideInput('')
  }
  const [stepIdx, setStepIdx] = useState(0)

  const handleExecute = () => {
    setPhase('loading'); setStepIdx(0); setTourIdx(0)
    let i = 0
    executeIntervalRef.current = setInterval(() => {
      i++; setStepIdx(i)
      if (i >= pipelineSteps.length - 1) {
        clearInterval(executeIntervalRef.current!)
        executeIntervalRef.current = null
      }
    }, 2500)
  }

  useEffect(() => {
    setTourIdx(prev => prev === stepIdx - 1 ? stepIdx : prev)
  }, [stepIdx])

  useEffect(() => {
    setRound2TourIdx(prev => prev === round2StepIdx - 1 ? round2StepIdx : prev)
  }, [round2StepIdx])

  useEffect(() => {
    if (autoStart) handleExecute()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (executeIntervalRef.current) clearInterval(executeIntervalRef.current)
    if (round2IntervalRef.current)  clearInterval(round2IntervalRef.current)
  }, [])

  const handleDownload = () => openAppealPdf(scenario)

  const ctx = useMemo<PocContextValue>(() => ({
    scenario, onReset, onSaveToPortfolio, onStartAppeal, reviewMode, caseStatus,
    phase, setPhase, dispatched, pendingDispatch, acknowledged, setAcknowledged,
    appealRef, traceOpen, setTraceOpen, hoveredCite, setHoveredCite,
    editMode, setEditMode, editedBody, setEditedBody,
    round2StepIdx, round2TourIdx, setRound2TourIdx,
    payerResponseResolution, setPayerResponseResolution,
    overrides, pendingOverride, setPendingOverride, overrideInput, setOverrideInput,
    stepIdx, tourIdx, setTourIdx,
    letterDate, pipelineSteps, unresolvedCriteria, satisfiedCriteria, allResolved,
    generateLetterBody, handleRound2Execute, confirmDispatch, cancelPendingDispatch,
    stagePendingDispatch, dispatchAll, applyOverride, handleExecute, handleDownload,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    scenario, onReset, onSaveToPortfolio, onStartAppeal, reviewMode, caseStatus,
    phase, dispatched, pendingDispatch, acknowledged,
    appealRef, traceOpen, hoveredCite,
    editMode, editedBody,
    round2StepIdx, round2TourIdx,
    payerResponseResolution,
    overrides, pendingOverride, overrideInput,
    stepIdx, tourIdx,
    letterDate, pipelineSteps, unresolvedCriteria, satisfiedCriteria, allResolved,
  ])

  return (
    <div className="flex-1 overflow-auto">
      <div id="tour-pipeline-header" className="px-8 py-6 border-b border-slate-800">
        <button
          onClick={onReset}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Case Queue
          <span className="text-slate-700 mx-1">·</span>
          <span className="text-slate-500">{scenario.drug}</span>
        </button>
        <h1 className="text-xl font-bold font-display text-white">
          {phase === 'review'    ? (isInitialPa ? 'Review PA Request' : 'Review Appeal Letter')
           : phase === 'submitted' ? (isInitialPa ? 'PA Request Filed' : 'Appeal Submitted')
           : 'Pipeline Execution'}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {phase === 'review'
            ? (isInitialPa
                ? 'Review carefully before authorizing — this request transmits to the payer via Da Vinci PAS'
                : 'Read carefully before authorizing submission — this document will be transmitted to the payer')
            : phase === 'submitted'
              ? <span className="text-emerald-400">{isInitialPa ? <>Filed to {scenario.plan}</> : <>Transmitted to {scenario.plan}</>}</span>
              : (isInitialPa
                  ? 'Prior authorization request assembled from the patient’s record — ready for review'
                  : 'Appeal drafted from the patient’s record — ready for review')}
        </p>
      </div>

      {phase === 'review' || phase === 'round2_done' ? (
        // Review phases: full-width — ReviewPanel has its own internal two-column
        // layout (letter left, citations right) that benefits from the extra space.
        <div className="p-8 space-y-5">
          <div className="flex items-center gap-4 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl text-sm">
            <Package className="w-5 h-5 text-slate-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-white font-medium">{scenario.drug}</span>
              <span className="text-slate-500 mx-2">·</span>
              <span className="text-slate-400">{scenario.plan}</span>
            </div>
            <span className="text-xs text-slate-500">{scenario.criteriaResults.length} rules loaded</span>
          </div>
          <CoverageResolutionLine scenarioId={scenario.id} />
          {scenario.timeline && caseStatus && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-5 py-4">
              <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Case Timeline</p>
              <CaseTimeline events={scenario.timeline} />
            </div>
          )}
          <PocProvider value={ctx}>
            {phase === 'review' ? (isInitialPa ? <PaRequestReviewPanel /> : <ReviewPanel />) : <Round2DonePanel />}
          </PocProvider>
          <CaseTechnicalDetails scenario={scenario} />
        </div>
      ) : (
        // All other phases: two-column — static context on the left, evolving
        // action panel on the right. Timeline lives in the right column so it
        // can lay out horizontally without being squeezed by the w-80 left rail.
        <div className="p-8 flex gap-6 items-start">
          <div className="w-80 shrink-0 space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-800/40 border border-slate-700/60 rounded-xl text-sm">
              <Package className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium leading-snug">{scenario.drug}</p>
                <p className="text-slate-400 text-xs mt-0.5">{scenario.plan}</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{scenario.criteriaResults.length} rules</span>
            </div>
            <CoverageResolutionLine scenarioId={scenario.id} />
            <CaseTechnicalDetails scenario={scenario} />
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            {scenario.timeline && caseStatus && (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-5 py-4">
                <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wide">Case Timeline</p>
                <CaseTimeline events={scenario.timeline} />
              </div>
            )}
            <PocProvider value={ctx}>
              {phase === 'submitted' ? <SubmittedPanel />
                : phase === 'round2_loading' ? <Round2LoadingPanel />
                : phase === 'round2_submitted' ? <Round2SubmittedPanel />
                : phase === 'done' && hasExceptions ? <ExceptionsPanel />
                : phase === 'done' ? <DonePanel />
                : <PipelineStartPanel />}
            </PocProvider>
          </div>
        </div>
      )}
    </div>
  )
}
