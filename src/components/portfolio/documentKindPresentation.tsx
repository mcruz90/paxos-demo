import {
  Database, FileText, FileWarning, FlaskConical,
  type LucideIcon, Mail, Pill, Stethoscope,
} from 'lucide-react'
import { type DocumentKind, documentKindMeta } from './documentKind'

// Shared view mapping from a document kind to its letterhead chrome (icon +
// accent). Tailwind needs static class strings, so each kind maps to a fixed
// presentation. Consumed by both CitationPane (excerpt cards) and
// SourceDocViewer (rendered documents) — kept here so the two never drift.
export const KIND_PRESENTATION: Record<DocumentKind, { Icon: LucideIcon; tone: string; chip: string }> = {
  payer_letter:    { Icon: Mail,         tone: 'text-amber-400',   chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  clinical_note:   { Icon: Stethoscope,  tone: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
  lab_report:      { Icon: FlaskConical, tone: 'text-sky-400',     chip: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
  medication_list: { Icon: Pill,         tone: 'text-violet-400',  chip: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
  ehr_record:      { Icon: Database,     tone: 'text-cyan-400',    chip: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
  unavailable:     { Icon: FileWarning,  tone: 'text-slate-400',   chip: 'bg-slate-700/40 text-slate-300 border-slate-600/40' },
  generic:         { Icon: FileText,     tone: 'text-slate-400',   chip: 'bg-slate-700/40 text-slate-300 border-slate-600/40' },
}

export interface SourcePresentation {
  kind: DocumentKind
  label: string
  Icon: LucideIcon
  tone: string
  chip: string
}

export function presentationForSource(source: string): SourcePresentation {
  const { kind, label } = documentKindMeta(source)
  return { kind, label, ...KIND_PRESENTATION[kind] }
}
