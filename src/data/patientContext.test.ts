import { describe, it, expect } from 'vitest'
import { initialClients, scenarios } from './scenarios'
import { resolvePatientContext } from './patientContext'

describe('resolvePatientContext', () => {
  const client = initialClients.find(c => c.scenarioId === 'novo-ozempic')!
  const scenario = scenarios[client.scenarioId]

  it('prefers the scenario-provided patientContext when present', () => {
    const provided = { ...resolvePatientContext(scenario, client), patientName: 'From Scenario' }
    const withContext = { ...scenario, patientContext: provided }
    expect(resolvePatientContext(withContext, client).patientName).toBe('From Scenario')
  })

  it('derives patient identity from the client record, never a canned default', () => {
    const ctx = resolvePatientContext(scenario, client)
    expect(ctx.patientName).toBe(client.patientDisplayName)
    expect(ctx.patientDob).toBe(client.patientDob)
    expect(ctx.prescriberSpecialty).toBe(client.categoryLabel)
  })

  it('derives a distinct member id per case reference', () => {
    // Scenarios that supply their own patientContext (golden-set cases like
    // humira-cigna) carry a real member id; the derive path only governs the
    // demo cases that don't, so scope the format/distinctness check to those.
    const derived = initialClients.filter(c => !scenarios[c.scenarioId]?.patientContext)
    const ids = derived.map(c => resolvePatientContext(scenarios[c.scenarioId], c).memberId)
    expect(new Set(ids).size).toBe(derived.length)
    expect(ids.every(id => /^MEM-\d+$/.test(id))).toBe(true)
  })

  it('marks unknown demographics with a placeholder instead of fabricating them', () => {
    const ctx = resolvePatientContext(scenario, client)
    expect(ctx.patientSex).toBe('—')
    expect(ctx.patientAddress).toBe('—')
    expect(ctx.groupId).toBe('—')
  })

  it('falls back to the case reference when no display name exists', () => {
    const bare = { ...client, patientDisplayName: undefined, patientDob: undefined }
    const ctx = resolvePatientContext(scenario, bare)
    expect(ctx.patientName).toBe(client.name)
    expect(ctx.patientDob).toBe('—')
  })
})
