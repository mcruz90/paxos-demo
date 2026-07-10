import { useState, type ReactNode } from 'react'
import { ArrowDown, FlaskConical } from 'lucide-react'
import { type ScenarioConfig } from '../types'
import { scenarios } from '../data/scenarios'

// Example-run spot-check for the Agent Instructions node graph. Pairs a node's
// instruction (the spec) with the payload it actually returned on a real
// golden-set case (the behavior), rendered as schema-typed JSON so it reads like
// the real call — with status/verdict values as chips for quick scanning. All
// values come from the scenario fixtures; the demo runs no live inference.

const RUN_CASES: ScenarioConfig[] = Object.values(scenarios).filter(s => s.criteriaResults?.length > 0)

const CHIP_CLS: Record<string, string> = {
  found:        'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  needs_review: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  conflict:     'text-red-300 bg-red-500/10 border-red-500/30',
  pass:         'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  fail:         'text-red-300 bg-red-500/10 border-red-500/30',
}
const CHIP_KEYS = new Set(['status', 'verdict'])

const INPUT_HINT: Record<string, string> = {
  ingestion:  'Raw denial letter + clinical record',
  retrieval:  'Validated intake + policy pack',
  synthesis:  'Grounded criteria + policy pack',
  gatekeeper: 'Drafted appeal + retrieval CriterionResult[] + policy pack',
}

function Chip({ value }: { value: string }) {
  const cls = CHIP_CLS[value] ?? 'text-slate-300 bg-slate-700/40 border-slate-600/40'
  return <span className={`inline-block px-1.5 rounded border text-[10px] font-sans align-middle ${cls}`}>{value}</span>
}

// Minimal JSON renderer: colors keys/strings/numbers/bools like a code block and
// swaps status/verdict string values for chips so a run is scannable at a glance.
function renderVal(v: unknown, indent: number, key?: string): ReactNode {
  const pad = '  '.repeat(indent + 1)
  const padEnd = '  '.repeat(indent)
  if (v === null) return <span className="text-slate-600">null</span>
  if (typeof v === 'boolean') return <span className={v ? 'text-emerald-400' : 'text-red-400'}>{String(v)}</span>
  if (typeof v === 'number') return <span className="text-amber-300">{v}</span>
  if (typeof v === 'string') {
    if (key && CHIP_KEYS.has(key)) return <Chip value={v} />
    return <span className="text-emerald-300/90">&quot;{v}&quot;</span>
  }
  if (Array.isArray(v)) {
    if (!v.length) return <span className="text-slate-600">[]</span>
    return (
      <>
        <span className="text-slate-600">[</span>{'\n'}
        {v.map((it, i) => (
          <span key={i}>{pad}{renderVal(it, indent + 1)}{i < v.length - 1 && <span className="text-slate-600">,</span>}{'\n'}</span>
        ))}
        {padEnd}<span className="text-slate-600">]</span>
      </>
    )
  }
  const entries = Object.entries(v as Record<string, unknown>)
  return (
    <>
      <span className="text-slate-600">{'{'}</span>{'\n'}
      {entries.map(([k, val], i) => (
        <span key={k}>{pad}<span className="text-sky-300">&quot;{k}&quot;</span><span className="text-slate-600">: </span>{renderVal(val, indent + 1, k)}{i < entries.length - 1 && <span className="text-slate-600">,</span>}{'\n'}</span>
      ))}
      {padEnd}<span className="text-slate-600">{'}'}</span>
    </>
  )
}

// Build the payload each node returns for a case, from the scenario fixtures —
// shaped like the real schema so it reads as an authentic call.
function payloadFor(nodeId: string, s: ScenarioConfig): { schema: string; data: unknown } {
  if (nodeId === 'ingestion') {
    return {
      schema: 'AppealIntake',
      data: {
        drug: s.drug,
        diagnosis: s.diagnosis,
        payer_plan: s.plan,
        denial_reason: s.denialReason || null,
        phi_tokenized: true,
      },
    }
  }
  if (nodeId === 'retrieval') {
    return {
      schema: 'CriterionResult[]',
      data: s.criteriaResults.map(cr => {
        const cite = s.citations[cr.rule.label]
        return {
          criterion: cr.rule.label,
          status: cr.status,
          ...(cr.confidence !== undefined ? { confidence: cr.confidence } : {}),
          citation: cite ? { source: cite.source, page: cite.page, quote: cite.text } : null,
          ...(cr.conflictSources ? { conflict_sources: cr.conflictSources.map(c => c.source) } : {}),
        }
      }),
    }
  }
  if (nodeId === 'synthesis') {
    const found = s.criteriaResults.filter(c => c.status === 'found')
    const escalated = s.criteriaResults.filter(c => c.status !== 'found')
    return {
      schema: 'GeneratedAppeal',
      data: {
        rebuts_denial: s.denialReason || null,
        claims: found.map(c => ({ criterion: c.rule.label, citation: s.citations[c.rule.label]?.source ?? null })),
        escalated: escalated.map(c => c.rule.label),
      },
    }
  }
  // gatekeeper — deterministic (no LLM). It validates the DRAFT against structured
  // input the prior nodes already produced: for every claim the draft asserts, it
  // cross-references the passed-in CriterionResult[] and the pack — rejecting any
  // whose status isn't `found` or that lacks a pack-traceable citation. That's a
  // lookup/set comparison, not a judgment, so an ungrounded assertion is caught
  // deterministically even though grounding was decided upstream.
  const asserted = s.criteriaResults.filter(c => c.status === 'found')
  const unciteds = asserted.filter(c => !s.citations[c.rule.label])
  const checks = {
    required_fields_present: true,
    minimum_substance: true,
    no_refusal_offtask: true,
    citation_provenance: unciteds.length === 0,
    schema_valid: true,
  }
  const pass = Object.values(checks).every(Boolean)
  const artifact = s.lifecycle === 'initial_pa'
    ? { artifact_type: 'initial_pa_request', contract: 'FHIR Da Vinci PAS / X12 278' }
    : { artifact_type: 'appeal_submission', contract: 'payer appeal-submission schema' }
  return {
    schema: 'GatekeeperResult',
    data: pass
      ? { verdict: 'pass', checks, submission_payload: { ...artifact, valid: true } }
      : {
          verdict: 'fail',
          checks,
          failure_reasons: unciteds.map(c => `citation_provenance: "${c.rule.label}" asserted without a pack-traceable citation`),
          action: 'retry with reduced context (bounded), then escalate to Exception',
        },
  }
}

export function NodeRunPanel({ nodeId }: { nodeId: string }) {
  const [caseId, setCaseId] = useState(RUN_CASES[0]?.id)
  const s = RUN_CASES.find(x => x.id === caseId) ?? RUN_CASES[0]
  if (!s) return null

  const { schema, data } = payloadFor(nodeId, s)

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <FlaskConical className="w-4 h-4 text-emerald-400" />Example run
        </div>
        <select
          value={caseId}
          onChange={e => setCaseId(e.target.value)}
          className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-slate-500 max-w-[60%] truncate"
        >
          {RUN_CASES.map(c => (
            <option key={c.id} value={c.id}>{c.drug.split(' ')[0]} · {c.diagnosis}</option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-snug">
        A real golden-set case — the payload this node returned. Fixture data; the demo runs no live inference.
      </p>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Input</p>
      <p className="text-xs text-slate-400">{INPUT_HINT[nodeId]}</p>

      <div className="flex items-center gap-2 text-slate-600 my-2.5">
        <div className="h-px flex-1 bg-slate-800" />
        <ArrowDown className="w-3.5 h-3.5" />
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Output</p>
      <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-3">
        <p className="text-[10px] font-mono text-slate-600 mb-1.5">{'// '}{schema}</p>
        <pre className="text-[11px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words">{renderVal(data, 0)}</pre>
      </div>
    </div>
  )
}
