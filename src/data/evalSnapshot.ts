import type { Decision, E2eRun, EvalSnapshot, Stage } from '../generated/evalSnapshotTypes'
import rawExampleSnapshot from './eval_snapshot.example.json'
import evalSnapshotSchema from './eval_snapshot.schema.json'
import { type JsonSchema, validateAgainstSchema } from './evalSnapshotSchemaValidator'

export type {
  Clock,
  Comparison,
  Decision,
  Dimension,
  E2eRun,
  E2eStage,
  EvalSnapshot,
  NotApplicable,
  RunVersions,
  SectionState,
  Stage,
} from '../generated/evalSnapshotTypes'

export type ParseEvalSnapshotResult =
  | { ok: true; snapshot: EvalSnapshot }
  | { ok: false; errors: string[] }

export interface ReadinessSummary {
  ready: number
  notYet: number
  noRuns: number
  notBuilt: number
  total: number
}

export function parseEvalSnapshot(raw: unknown): ParseEvalSnapshotResult {
  const errors = validateAgainstSchema(raw, evalSnapshotSchema as JsonSchema)
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, snapshot: raw as EvalSnapshot }
}

export function loadDefaultEvalSnapshot(): EvalSnapshot | null {
  const res = parseEvalSnapshot(rawExampleSnapshot)
  return res.ok ? res.snapshot : null
}

export const DEFAULT_EVAL_SNAPSHOT: EvalSnapshot | null = loadDefaultEvalSnapshot()

export function isDecisionAccepted(decision: Pick<Decision, 'status'>): boolean {
  return decision.status.trim().toLowerCase().startsWith('accepted')
}

export function formatShortCommit(commit: string): string {
  const clean = commit.trim()
  if (!clean || clean === 'unknown') return 'unknown'
  return clean.slice(0, 8)
}

export function formatStageCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US')
}

export function formatWilsonRange(range: number[] | null | undefined): string {
  if (!range || range.length < 2) return '—'
  const [low, high] = range
  if (!Number.isFinite(low) || !Number.isFinite(high)) return '—'
  return `${(low * 100).toFixed(2)}%–${(high * 100).toFixed(2)}%`
}

export function formatExactPValue(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—'
  if (p > 0 && p < 0.001) return p.toExponential(4)
  return String(p)
}

export function summarizeReadiness(stages: Stage[]): ReadinessSummary {
  const summary: ReadinessSummary = { ready: 0, notYet: 0, noRuns: 0, notBuilt: 0, total: stages.length }
  for (const st of stages) {
    if (st.state === 'ready') summary.ready++
    else if (st.state === 'not_yet') summary.notYet++
    else if (st.state === 'no_runs') summary.noRuns++
    else if (st.state === 'not_built') summary.notBuilt++
  }
  return summary
}

export function formatStageTargetSummary(stage: Stage): string {
  const t = stage.target
  if (!t) return 'Not built yet'
  const maxErrors = typeof t.max_errors === 'number' ? t.max_errors : null
  const minN = typeof t.min_n === 'number' ? t.min_n : null
  const minRight = typeof t.min_right === 'number' ? t.min_right : null
  const parts: string[] = []
  if (maxErrors !== null) parts.push(`≤ ${maxErrors} costly errors`)
  if (minN !== null) parts.push(`n ≥ ${minN}`)
  if (minRight !== null) parts.push(`hands-off ≥ ${Math.round(minRight * 100)}%`)
  if (t.needs_second_labeller === true) parts.push('2nd clinician labeler')
  return parts.join(' · ') || 'Target defined'
}

export function totalE2eSilentErrors(runs: E2eRun[]): number {
  return runs.reduce((acc, r) => acc + r.outcomes.silent, 0)
}
