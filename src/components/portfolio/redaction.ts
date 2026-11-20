import type { PatientContext, SourceDocBlock } from '../../types'

// ---------------------------------------------------------------------------
// Build-plane redaction — deterministic, mirrors the backend redact_phi()
// discipline (ADR-0014): identifiers are stripped by pattern/known value, and
// what leaves is a ledger of *what* was removed and *why*, never the PHI
// itself. Pure and string-only, unit-tested in redaction.test.ts. This is the
// demo-local stand-in for the pre-ingestion EHR-connector redaction.
// ---------------------------------------------------------------------------

export type PhiCategory = 'Name' | 'Date' | 'Member ID' | 'MRN'

export interface PhiDictionary {
  names: string[]
  memberId?: string
  mrn?: string
}

export interface RedactionEntry {
  category: PhiCategory
  token: string
  reason: string
  count: number
}

const REASON: Record<PhiCategory, string> = {
  Name:        'Name (masked)',
  Date:        'Date month/day (masked; year kept)',
  'Member ID': 'Member ID (masked)',
  MRN:         'MRN pattern (masked)',
}
const TOKEN: Record<Exclude<PhiCategory, 'Date'>, string> = {
  Name:        '[REDACTED — NAME]',
  'Member ID': '[REDACTED — MEMBER ID]',
  MRN:         '[REDACTED — MRN]',
}

const DATE_RE = /\b\d{1,2}\/\d{1,2}\/(\d{4})\b/g
const MRN_RE  = /\bMRN[-:\s]*[A-Za-z]?-?\d{3,}\b/gi

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Replaces matched identifiers with category tokens; dates keep their year
// and mask month/day. Demo pattern matcher only — not HIPAA Safe Harbor.
export function redactText(text: string, phi: PhiDictionary): { text: string; hits: PhiCategory[] } {
  const hits: PhiCategory[] = []
  let out = text

  if (phi.mrn) {
    out = out.replace(new RegExp(escapeRegExp(phi.mrn), 'g'), () => { hits.push('MRN'); return TOKEN.MRN })
  }
  out = out.replace(MRN_RE, () => { hits.push('MRN'); return TOKEN.MRN })

  if (phi.memberId) {
    out = out.replace(new RegExp(escapeRegExp(phi.memberId), 'g'), () => { hits.push('Member ID'); return TOKEN['Member ID'] })
  }

  // Longest names first so a full name isn't half-shadowed by a surname match.
  for (const name of [...phi.names].filter(Boolean).sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g'), () => { hits.push('Name'); return TOKEN.Name })
  }

  out = out.replace(DATE_RE, (_m, yyyy) => { hits.push('Date'); return `XX/XX/${yyyy}` })

  return { text: out, hits }
}

export function redactBlocks(
  blocks: SourceDocBlock[],
  phi: PhiDictionary,
): { blocks: SourceDocBlock[]; ledger: RedactionEntry[] } {
  const counts = new Map<PhiCategory, number>()
  const redacted = blocks.map(b => {
    const { text, hits } = redactText(b.text, phi)
    for (const h of hits) counts.set(h, (counts.get(h) ?? 0) + 1)
    return { ...b, text }
  })
  const order: PhiCategory[] = ['Name', 'Date', 'Member ID', 'MRN']
  const ledger: RedactionEntry[] = order
    .filter(c => counts.has(c))
    .map(c => ({
      category: c,
      token: c === 'Date' ? 'XX/XX/YYYY' : TOKEN[c],
      reason: REASON[c],
      count: counts.get(c)!,
    }))
  return { blocks: redacted, ledger }
}

// Builds the redaction dictionary from a resolved patient identity: the full
// name plus its parts (dropping middle initials), and a real member id.
export function phiFromContext(ctx: PatientContext): PhiDictionary {
  const parts = ctx.patientName.split(/\s+/).filter(w => w.replace(/\./g, '').length > 1)
  const names = Array.from(new Set([ctx.patientName, ...parts])).filter(n => n && n !== '—')
  return {
    names,
    memberId: ctx.memberId && ctx.memberId !== '—' ? ctx.memberId : undefined,
  }
}

export function deriveSpecialtyToken(specialty?: string): string {
  const s = (specialty ?? '').toLowerCase()
  if (s.includes('hepatolog')) return '{{HEPATOLOGIST_NAME_1}}'
  if (s.includes('rheumatolog')) return '{{RHEUMATOLOGIST_NAME_1}}'
  if (s.includes('endocrinolog')) return '{{ENDOCRINOLOGIST_NAME_1}}'
  if (s.includes('pediatric') || s.includes('gastro')) return '{{PEDIATRIC_GI_NAME_1}}'
  return '{{PRESCRIBER_NAME_1}}'
}

export function shiftClinicalDates(
  text: string,
  offsetDays = -42,
): { text: string; count: number } {
  let count = 0
  const out = text.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_m, mm, dd, yyyy) => {
    const dt = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd) + offsetDays))
    const mStr = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const dStr = String(dt.getUTCDate()).padStart(2, '0')
    const sign = offsetDays >= 0 ? `+${offsetDays}` : String(offsetDays)
    count += 1
    return `${mStr}/${dStr}/${dt.getUTCFullYear()} [shifted ${sign}d]`
  })
  return { text: out, count }
}

export interface EvalPlaneTokenizationMeta {
  specialtyToken: string
  dateOffsetDays: number
  residualHeld: boolean
  shiftedSampleCount: number
}

export function buildEvalPlaneTokenization(
  blocks: SourceDocBlock[],
  ctx: PatientContext,
  offsetDays = -42,
): EvalPlaneTokenizationMeta {
  const phi = phiFromContext(ctx)
  const { blocks: tokenized } = redactBlocks(blocks, phi)
  const joined = tokenized.map(b => b.text).join(' ')
  const leakFound =
    phi.names.some(n => n.length > 1 && joined.includes(n)) ||
    (!!phi.memberId && joined.includes(phi.memberId))

  const shiftedSampleCount = blocks.reduce(
    (sum, b) => sum + shiftClinicalDates(b.text, offsetDays).count,
    0,
  )

  return {
    specialtyToken: deriveSpecialtyToken(ctx.prescriberSpecialty),
    dateOffsetDays: offsetDays,
    residualHeld: leakFound,
    shiftedSampleCount,
  }
}
