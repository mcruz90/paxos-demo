import { type ReactNode } from 'react'
import { Activity, Settings, Clock, ShieldAlert, User, Pill, Code, Info, Boxes } from 'lucide-react'
import { type CaseStatus, type CaseTier, type PaTargetType, type RuleType, type Urgency } from '../types'

export function DueBadge({ deadline, urgency }: { deadline: string; urgency: Urgency }) {
  const cls: Record<Urgency, string> = {
    today: 'text-red-300 bg-red-500/10 border-red-500/30',
    soon:  'text-amber-300 bg-amber-500/10 border-amber-500/30',
    later: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${cls[urgency]}`}>
      {deadline}
    </span>
  )
}

export function TierBadge({ tier }: { tier: CaseTier }) {
  // DISPLAY labels only — enum values (routine/complex/exception) are the
  // audit/ADR/TierRouter vocabulary and stay untouched. Every case is reviewed
  // by a human before it leaves the system; the tier names how much the AI could
  // pre-assemble and what the human must do: 'Full Review' = read closely before
  // filing; 'Escalation' = the AI hit a gap it can't resolve and handed off.
  // 'Exception' is deliberately avoided here — it collides with the amber
  // CaseStatus='exception' workflow chip (a different axis).
  if (tier === 'exception') return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">
      Escalation
    </span>
  )
  if (tier === 'complex') return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
      Full Review
    </span>
  )
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
      Routine
    </span>
  )
}


export const ruleIcons: Record<RuleType, React.ReactNode> = {
  diagnostic: <Activity className="w-4 h-4" />,
  math:       <Settings className="w-4 h-4" />,
  temporal:   <Clock className="w-4 h-4" />,
  safety:     <ShieldAlert className="w-4 h-4" />,
  provider:   <User className="w-4 h-4" />,
  quantity:   <Pill className="w-4 h-4" />,
  custom:     <Code className="w-4 h-4" />,
}

export const ruleColors: Record<RuleType, string> = {
  diagnostic: 'text-slate-300 bg-slate-700/30 border-slate-600/30',
  math:       'text-slate-300 bg-slate-700/30 border-slate-600/30',
  temporal:   'text-slate-300 bg-slate-700/30 border-slate-600/30',
  safety:     'text-slate-300 bg-slate-700/30 border-slate-600/30',
  provider:   'text-slate-300 bg-slate-700/30 border-slate-600/30',
  quantity:   'text-slate-300 bg-slate-700/30 border-slate-600/30',
  custom:     'text-slate-300 bg-slate-700/30 border-slate-600/30',
}

export function RuleTag({ type }: { type: RuleType }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${ruleColors[type]}`}>
      {ruleIcons[type]}
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

export function StageBadge({ stage }: { stage: 'Initial PA' | 'Appeal' }) {
  // Initial PA is highlighted (the front-of-lifecycle work we lead with); Appeal
  // is neutral. Kept off the status palette (emerald/amber/violet) so the two
  // columns don't read as the same axis.
  const className = stage === 'Initial PA'
    ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
    : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${className}`}>
      {stage}
    </span>
  )
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const config: Record<CaseStatus, { label: string; className: string }> = {
    processing:             { label: 'Processing',             className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    ready_for_review:       { label: 'Ready for Review',       className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    exception:              { label: 'Exception',              className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    awaiting_documentation: { label: 'Awaiting Documentation', className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    submitted:              { label: 'Submitted',              className: 'bg-slate-600/30 text-slate-400 border-slate-600/30' },
    payer_response:         { label: 'Payer Response',         className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  }
  const { label, className } = config[status]
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${className}`}>
      {label}
    </span>
  )
}

// Gemini-roster idiom: a tiny uppercase tag for what the PA targets. All cases
// today are medications; the badge future-proofs device/procedure lifecycles.
const TARGET_BADGE: Record<PaTargetType, { label: string; cls: string }> = {
  medication: { label: 'MEDS',   cls: 'bg-slate-800 border-slate-700 text-slate-400' },
  device:     { label: 'DEVICE', cls: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
  procedure:  { label: 'PROC',   cls: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
}

export function TargetBadge({ target }: { target: PaTargetType | undefined }) {
  const { label, cls } = TARGET_BADGE[target ?? 'medication']
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-semibold tracking-wide ${cls}`}>
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Glossary + inline hints — make domain terms self-explaining for new users.
// Single source of truth: every tooltip pulls from GLOSSARY by key.
// ---------------------------------------------------------------------------

export const GLOSSARY: Record<string, string> = {
  blocking: 'Blocking criterion — must be satisfied or the request is denied. A single unmet blocking rule stops the appeal; there is no path around it.',
  supporting: 'Supporting criterion — strengthens the case but is not a hard gate. Can be satisfied by an explicit statement or a well-supported inference from the record (with the basis cited).',
  routine: 'Routine tier — a low-ambiguity case the AI resolves end-to-end. A coordinator approves the finished appeal with a glance.',
  complex: 'Complex tier — a multi-round or judgment-heavy case (e.g. a payer counter-offer). The AI drafts; a coordinator reviews closely before filing.',
  exception: 'Exception tier — the AI found a gap it cannot resolve from the record (e.g. a missing document). It stops and escalates to a human instead of guessing.',
  diagnostic: 'Diagnostic rule — confirms a clinical diagnosis is present (or absent) in the record: ICD codes, consult notes, attending documentation.',
  temporal: 'Temporal rule — verifies a prior therapy ran for a minimum duration (e.g. metformin ≥ 90 days), with documented intolerance as a bypass.',
  math: 'Biomarker / math rule — compares an extracted lab value to a threshold (absolute, multiple of the upper limit of normal, or within a recency window).',
  safety: 'Safety / contraindication rule — a hard exclusion gate. If the contraindication is documented, the pipeline halts and returns Denied regardless of other criteria.',
  provider: 'Provider rule — confirms the ordering or co-signing clinician meets the payer’s specialty and credentialing requirements.',
  quantity: 'Dose / quantity rule — checks the requested dose or quantity is within payer-approved bounds (supports weight- and age-based dosing).',
  satisfied: 'Satisfied — the retrieval agent located evidence in the record that meets this criterion, with a citation.',
  unresolved: 'Unresolved — no evidence meeting this criterion was found. A blocking unresolved criterion sends the case to the Exception tier.',
  conflict: 'Conflict — two source documents make contradictory claims about the same criterion. The system surfaces both and routes to a human to adjudicate; it never silently picks one. Distinct from Unresolved, where evidence is simply missing.',
  gatekeeper: 'Gatekeeper — a deterministic (non-LLM) safety check every generated letter must pass before a human sees it. It cannot be talked out of a denial.',
  'canonical schema': 'Canonical schema — the single normalized data shape every connector maps into, so the downstream engine never sees client-specific formats.',
  'policy pack': 'Policy pack — one drug × carrier configuration: the criteria, thresholds, and edge cases for that specific payer policy.',
}

// Tooltip bubble — positioned above its trigger; trigger must be `group/hint relative`.
export function HintBubble({ text, wide }: { text: string; wide?: boolean }) {
  return (
    <span className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${wide ? 'w-72' : 'w-60'} px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-normal normal-case tracking-normal text-slate-300 leading-relaxed text-left opacity-0 group-hover/hint:opacity-100 transition-opacity duration-150 z-50 shadow-xl`}>
      {text}
    </span>
  )
}

// Small (i) icon that reveals a glossary definition on hover.
export function InfoHint({ term, text, wide }: { term?: string; text?: string; wide?: boolean }) {
  const body = text ?? (term ? GLOSSARY[term.toLowerCase()] : '') ?? ''
  if (!body) return null
  return (
    <span className="relative inline-flex group/hint align-middle">
      <Info className="w-3 h-3 text-slate-500 hover:text-slate-300 cursor-help shrink-0" />
      <HintBubble text={body} wide={wide} />
    </span>
  )
}

// Wraps an existing label/badge so hovering it reveals the glossary definition.
export function Term({ children, term, wide }: { children: ReactNode; term: string; wide?: boolean }) {
  const body = GLOSSARY[term.toLowerCase()] ?? ''
  if (!body) return <>{children}</>
  return (
    <span className="relative inline-flex group/hint cursor-help">
      {children}
      <HintBubble text={body} wide={wide} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Eval Dashboard — mock quality metrics (illustrative, not instrumented)
// ---------------------------------------------------------------------------


export function IllustrativeTag() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 border border-slate-700/60 text-xs text-slate-400">
      <Info className="w-3 h-3" />Illustrative · demo scenario
    </span>
  )
}

export function RoleChip({ layer }: { layer: 'build' | 'scale' }) {
  if (layer === 'build') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
        <Code className="w-3 h-3" />Build layer
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
      <Boxes className="w-3 h-3" />Scale layer
    </span>
  )
}
