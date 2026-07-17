import { describe, it, expect } from 'vitest'
import { type Client } from '../../types'
import { initialClients } from '../../data/scenarios'
import { patientForClient, patientsFromClients } from './patient'

function client(id: number, patientRef: string, name: string, scenarioId: string): Client {
  return {
    id, patientRef, name: `Case #${scenarioId}`, drug: 'X', categoryLabel: 'Y',
    patientDisplayName: name, status: 'ready_for_review', clientType: 'patient',
    lastUpdated: '', scenarioId, deadline: '', urgency: 'later',
  }
}

describe('patientsFromClients', () => {
  it('groups multiple cases under one patientRef', () => {
    const cs = [
      client(1, 'PT-1', 'Ann Lee', 'a'),
      client(2, 'PT-1', 'Ann Lee', 'b'),
      client(3, 'PT-2', 'Bo Kim', 'c'),
    ]
    const patients = patientsFromClients(cs)
    expect(patients).toHaveLength(2)
    const ann = patients.find(p => p.patientRef === 'PT-1')!
    expect(ann.cases).toHaveLength(2)
    expect(ann.displayName).toBe('Ann Lee')
    expect(patients.find(p => p.patientRef === 'PT-2')!.cases).toHaveLength(1)
  })

  it('falls back to the case name when a client has no patientRef', () => {
    const c = { ...client(1, '', 'Solo', 'a'), patientRef: undefined }
    const patients = patientsFromClients([c])
    expect(patients).toHaveLength(1)
    expect(patients[0].cases).toHaveLength(1)
  })

  it('every golden-set client resolves to exactly one patient', () => {
    const patients = patientsFromClients(initialClients)
    const total = patients.reduce((n, p) => n + p.cases.length, 0)
    expect(total).toBe(initialClients.length)
  })
})

describe('patientForClient', () => {
  it('returns the patient that owns the given case', () => {
    const cs = [client(1, 'PT-1', 'Ann', 'a'), client(2, 'PT-1', 'Ann', 'b')]
    const p = patientForClient(cs, cs[1])
    expect(p.patientRef).toBe('PT-1')
    expect(p.cases.map(c => c.scenarioId)).toContain('b')
  })
})
