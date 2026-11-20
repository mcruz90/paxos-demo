// AUTO-GENERATED from src/data/eval_snapshot.schema.json — DO NOT EDIT.
// Run: npm run eval:types

export type SectionState = 'measured' | 'not_run' | 'not_built' | 'defined'

export interface Decision {
  number: string
  status: string
}

export type NullableString = string | null

export interface RedteamKind {
  kind: 'redteam' | 'redteam_holdout'
  held: number
  n: number
  not_held: number
  not_held_range95: number[]
}

export interface CaseSet {
  family: 'intake' | 'llm_fallback' | 'deid' | 'charts' | 'doc_type'
  run_id: string
  created: NullableString
  cases: number
  by_kind: Record<string, unknown>
}

export interface NotBuiltItem {
  id: 'runtime_cost' | 'per_case_results' | 'rubric_history' | 'site_readiness'
  name: string
  why: string
}

export interface Stage {
  id: string
  name: string
  state: 'ready' | 'not_yet' | 'no_runs' | 'not_built'
  why: string
  target: Record<string, unknown> | null
  errors?: number
  n?: number
  error_range95?: number[] | null
  right?: {
    k: number
    n: number
  } | null
  candidate?: NullableString
  in_clearauth?: boolean | null
  lead?: NullableString
  checked?: NullableString
  basis?: NullableString
}

export interface E2eStage {
  id: string
  name: string
  run: number | null
  ok: number | null
  held: number | null
  silent: number | null
  inherited: number | null
  gold_fed_ok: number | null
  gold_fed_run: number | null
}

export interface E2eRun {
  run_id: string
  created: NullableString
  flow: string
  deid: string
  fallback_model: NullableString
  cases: number
  outcomes: {
    pass: number
    held: number
    wrong: number
    silent: number
  }
  stages: E2eStage[]
  first_failure: {
    id: string
    cases: number
  }[]
  by_denial?: Record<string, unknown>
  missed_appeals?: Record<string, unknown>
}

export interface Dimension {
  id: string
  kind: 'deterministic' | 'entailment' | 'judge'
  question: string
  state: 'measured' | 'defined'
  calibration?: {
    n: number
    kappa: number | null
    calibrated: boolean
  }
}

export interface RunVersions {
  run_id: string
  prompt_version: string
  request_version: string
}

export interface Comparison {
  a: RunVersions
  b: RunVersions
  left_out: number
  gaps: number
  a_correct: number
  b_correct: number
  a_range: number[] | null
  b_range: number[] | null
  fixed: number
  broke: number
  new_silent_errors: number
  p_value: number
  decision: string
  delta?: number
  delta_low?: number
  delta_high?: number
}

export interface Clock {
  id: string
  program: string
  request_type: string
  urgency: 'standard' | 'expedited'
  duration: number
  unit: 'hours' | 'calendar_days'
  start_event: string
  citation: string
  verified_on: string[]
}

export interface NotApplicable {
  id: string
  rule: string
  subject: string
  citation: string
}

export interface EvalSnapshot {
  schema_version: '2'
  as_of_commit: string
  generated_at: string
  basis: string
  readiness: {
    state: SectionState
    decision: Decision
    stages: Stage[]
  }
  e2e: {
    state: SectionState
    decision: Decision
    runs: E2eRun[]
  }
  appeal_rubric: {
    state: SectionState
    decision: Decision
    dimensions: Dimension[]
    judge_bar: {
      min_letters: number
      min_kappa: number
      status: 'proposed' | 'accepted'
    }
  }
  paired_prompts: {
    state: SectionState
    why?: string
    runs: RunVersions[]
    comparison?: Comparison
  }
  clocks: {
    state: SectionState
    decision: Decision
    clocks: Clock[]
    not_applicable: NotApplicable[]
  }
  redteam: {
    state: SectionState
    decision: Decision
    run_id: NullableString
    created: NullableString
    kinds: RedteamKind[]
  }
  case_sets: {
    state: SectionState
    decision: Decision
    families: CaseSet[]
  }
  not_built: {
    state: SectionState
    decision: Decision
    items: NotBuiltItem[]
  }
}
