// Classifies a citation's `source` string into the kind of document it came
// from, so the CitationPane can render each piece of evidence inside matching
// document chrome (a payer letter looks different from a lab report). Pure and
// string-only — unit-tested in documentKind.test.ts against the exact source
// strings the golden-set fixtures use. Extend the keyword tables (not the
// callers) when a new source shape appears.

export type DocumentKind =
  | 'payer_letter'
  | 'clinical_note'
  | 'lab_report'
  | 'medication_list'
  | 'ehr_record'
  | 'unavailable' // 'Conflict' / 'Missing' markers — not a real document
  | 'generic'

// First matching row wins, so order from most specific to most general.
const KIND_RULES: { kind: DocumentKind; keywords: string[] }[] = [
  { kind: 'unavailable',     keywords: ['conflict', 'missing'] },
  { kind: 'payer_letter',    keywords: ['denial', 'determination', 'coverage', 'policy', 'payer', 'letter'] },
  { kind: 'lab_report',      keywords: ['lab'] },
  { kind: 'medication_list', keywords: ['medication', 'med list'] },
  { kind: 'ehr_record',      keywords: ['fhir', 'epic', 'ehr'] },
  { kind: 'clinical_note',   keywords: ['consult', 'note', 'summary', 'evaluation', 'assessment', 'visit'] },
]

const KIND_LABELS: Record<DocumentKind, string> = {
  payer_letter:    'Payer Letter',
  clinical_note:   'Clinical Note',
  lab_report:      'Lab Report',
  medication_list: 'Medication List',
  ehr_record:      'EHR Record',
  unavailable:     'Unavailable',
  generic:         'Source Document',
}

export function classifyDocumentKind(source: string): DocumentKind {
  const s = source.toLowerCase()
  for (const { kind, keywords } of KIND_RULES) {
    if (keywords.some(k => s.includes(k))) return kind
  }
  return 'generic'
}

export interface DocumentKindMeta {
  kind: DocumentKind
  label: string
}

export function documentKindMeta(source: string): DocumentKindMeta {
  const kind = classifyDocumentKind(source)
  return { kind, label: KIND_LABELS[kind] }
}
