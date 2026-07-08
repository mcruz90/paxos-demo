import { createContext, useContext, type ReactNode } from 'react'
import type { CaseStatus, CriterionResult, ScenarioConfig, SimPhase } from '../../types'
import type { PipelineStep } from './pipeline'

export interface PocContextValue {
  scenario: ScenarioConfig
  onReset: () => void
  onSaveToPortfolio?: () => void
  onStartAppeal?: (scenarioId: string) => void
  reviewMode?: boolean
  caseStatus?: CaseStatus
  phase: SimPhase
  setPhase: React.Dispatch<React.SetStateAction<SimPhase>>
  dispatched: string[]
  pendingDispatch: string[]
  acknowledged: boolean
  setAcknowledged: React.Dispatch<React.SetStateAction<boolean>>
  appealRef: string
  traceOpen: boolean
  setTraceOpen: React.Dispatch<React.SetStateAction<boolean>>
  hoveredCite: number | null
  setHoveredCite: React.Dispatch<React.SetStateAction<number | null>>
  editMode: boolean
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>
  editedBody: string | null
  setEditedBody: React.Dispatch<React.SetStateAction<string | null>>
  round2Loading: boolean
  round2StepIdx: number
  round2TourIdx: number
  setRound2TourIdx: React.Dispatch<React.SetStateAction<number>>
  payerResponseResolution: 'accepted' | null
  setPayerResponseResolution: React.Dispatch<React.SetStateAction<'accepted' | null>>
  overrides: Record<string, string>
  pendingOverride: string | null
  setPendingOverride: React.Dispatch<React.SetStateAction<string | null>>
  overrideInput: string
  setOverrideInput: React.Dispatch<React.SetStateAction<string>>
  stepIdx: number
  tourIdx: number
  setTourIdx: React.Dispatch<React.SetStateAction<number>>
  letterDate: string
  pipelineSteps: PipelineStep[]
  unresolvedCriteria: CriterionResult[]
  satisfiedCriteria: CriterionResult[]
  allResolved: boolean
  generateLetterBody: () => string
  handleRound2Execute: () => void
  confirmDispatch: (ruleLabel: string) => void
  cancelPendingDispatch: (ruleLabel: string) => void
  stagePendingDispatch: (ruleLabel: string) => void
  dispatchAll: () => void
  applyOverride: (ruleLabel: string) => void
  handleExecute: () => void
  handleDownload: () => void
}

const PocContext = createContext<PocContextValue | null>(null)

export function PocProvider({ value, children }: { value: PocContextValue; children: ReactNode }) {
  return <PocContext.Provider value={value}>{children}</PocContext.Provider>
}

export function usePoc(): PocContextValue {
  const ctx = useContext(PocContext)
  if (!ctx) throw new Error('usePoc must be used within a PocProvider')
  return ctx
}
