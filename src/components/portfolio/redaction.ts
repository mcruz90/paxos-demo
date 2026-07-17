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
  Name:        'Names — HIPAA Safe Harbor §164.514(b)(2)(A)',
  Date:        'Dates more specific than year — §(C)',
  'Member ID': 'Health-plan beneficiary number — §(H)',
  MRN:         'Medical record number — §(G)',
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

// Replaces PHI with category tokens; dates keep their year (years are Safe-
// Harbor-permissible), everything more specific is masked.
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
