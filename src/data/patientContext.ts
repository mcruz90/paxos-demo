import type { Client, PatientContext, ScenarioConfig } from '../types'

// ---------------------------------------------------------------------------
// Patient context for letter previews. Golden-set scenarios carry their own
// patientContext; for the demo queue cases that don't, this derives one from
// the Client record instead of inventing identity facts. Unknown fields render
// as an em dash — a payer-facing artifact never shows fabricated demographics.
// ---------------------------------------------------------------------------

const UNKNOWN = '—'

// The demo tenant is a single clinic (TENANT: Meridian Health System), so one
// demo prescriber across its queue is coherent. All values fictional.
const DEMO_PRESCRIBER = {
  prescriberName: 'Dr. Sarah Jenkins, MD',
  prescriberNpi: '1048299104',
  prescriberAddress: 'Meridian Specialty Clinic, Philadelphia, PA 19106',
  prescriberPhone: '(215) 555-0199',
}

// 'Case #PH-3101' → 'MEM-3101': deterministic per case, never shared across
// patients the way a single hard-coded member id would be.
function memberIdFrom(caseRef: string): string {
  const digits = caseRef.replace(/\D/g, '')
  return digits ? `MEM-${digits}` : UNKNOWN
}

export function resolvePatientContext(scenario: ScenarioConfig, client: Client): PatientContext {
  if (scenario.patientContext) return scenario.patientContext
  return {
    patientName: client.patientDisplayName ?? client.name,
    patientDob: client.patientDob ?? UNKNOWN,
    patientSex: UNKNOWN,
    memberId: memberIdFrom(client.name),
    groupId: UNKNOWN,
    patientAddress: UNKNOWN,
    prescriberSpecialty: client.categoryLabel,
    ...DEMO_PRESCRIBER,
  }
}
