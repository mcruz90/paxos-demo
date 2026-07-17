import { type Client, type PaTargetType } from '../../types'

// ---------------------------------------------------------------------------
// Patient model — groups cases (PAs) by patient so the UI can present a
// patient-centric profile instead of only a flat case queue. Pure functions;
// the demo-local stand-in for a real tenancy model (O9/G1 backend gap).
// ---------------------------------------------------------------------------

export interface Patient {
  patientRef: string
  displayName: string
  dob?: string
  payer?: string
  cases: Client[] // active PAs in the queue for this patient
}

function refOf(c: Client): string {
  return c.patientRef ?? c.name
}

export function patientsFromClients(clients: Client[]): Patient[] {
  const byRef = new Map<string, Client[]>()
  for (const c of clients) {
    const ref = refOf(c)
    ;(byRef.get(ref) ?? byRef.set(ref, []).get(ref)!).push(c)
  }
  return [...byRef.entries()].map(([patientRef, cases]) => ({
    patientRef,
    displayName: cases[0].patientDisplayName ?? cases[0].name,
    dob: cases[0].patientDob,
    payer: cases[0].payer,
    cases,
  }))
}

export function patientForClient(clients: Client[], client: Client): Patient {
  const ref = refOf(client)
  return patientsFromClients(clients).find(p => p.patientRef === ref)!
}

// ── Patient-level demo data (Clinical Profile / Trial log / PA history) ──────
// Authored per patient, keyed by patientRef. Frontend demo data only — no
// backend, no real PHI. Modules fall back to derived/empty states when a
// patient has no authored profile.

export interface ClinicalProfileData {
  diagnoses: { code: string; label: string; since?: string }[]
  medications: { name: string; sig: string }[]
  allergies: string[]
  summary?: string
}

export interface TrialLogEntry {
  date: string
  therapy: string
  facility: string
  quantity: string
  supply: string
  fhirRef: string
  verified: boolean
}

export interface PaHistoryEntry {
  drug: string
  targetType: PaTargetType
  filedDate: string
  decision: 'approved' | 'denied' | 'withdrawn'
  determinationId?: string
}

export interface PatientProfileData {
  clinical?: ClinicalProfileData
  trials?: TrialLogEntry[]
  compliance?: { pdc: string; durationDays: number }
  paHistory?: PaHistoryEntry[]
}
