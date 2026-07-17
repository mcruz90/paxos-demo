import { describe, it, expect } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import { resolvePatientContext } from '../../data/patientContext'
import { phiFromContext, redactBlocks, redactText } from './redaction'

describe('redactText', () => {
  const phi = { names: ['Margaret Vance', 'Vance'], memberId: 'CGN-88231-07' }

  it('masks names but preserves the surrounding clinical facts', () => {
    const { text, hits } = redactText('Dear Ms. Vance, T2DM (E11.9) confirmed.', phi)
    expect(text).toBe('Dear Ms. [REDACTED — NAME], T2DM (E11.9) confirmed.')
    expect(hits).toContain('Name')
  })

  it('keeps the year but masks the month/day of every date (Safe Harbor)', () => {
    const { text, hits } = redactText('Consult 02/08/2024; DOB 03/14/1972.', phi)
    expect(text).toBe('Consult XX/XX/2024; DOB XX/XX/1972.')
    expect(hits.filter(h => h === 'Date')).toHaveLength(2)
  })

  it('masks an exact member id and an MRN pattern', () => {
    const { text } = redactText('Member CGN-88231-07, MRN E-904128 on file.', phi)
    expect(text).toContain('[REDACTED — MEMBER ID]')
    expect(text).toContain('[REDACTED — MRN]')
    expect(text).not.toContain('904128')
  })

  it('leaves text with no PHI untouched', () => {
    const { text, hits } = redactText('Fasting glucose 187 mg/dL; BMI 33.2.', phi)
    expect(text).toBe('Fasting glucose 187 mg/dL; BMI 33.2.')
    expect(hits).toHaveLength(0)
  })
})

describe('redactBlocks', () => {
  it('aggregates a ledger by category with counts and Safe-Harbor reasons', () => {
    const blocks = [
      { text: 'Dear Ms. Vance,' },
      { text: 'Seen 02/08/2024 and 01/10/2024.' },
    ]
    const { blocks: out, ledger } = redactBlocks(blocks, { names: ['Vance'] })
    expect(out[0].text).toBe('Dear Ms. [REDACTED — NAME],')
    const name = ledger.find(e => e.category === 'Name')!
    const date = ledger.find(e => e.category === 'Date')!
    expect(name.count).toBe(1)
    expect(date.count).toBe(2)
    expect(name.reason).toMatch(/Safe Harbor/)
  })

  it('preserves the criterionLabel so cited spans still light after redaction', () => {
    const blocks = [{ text: 'Vance, T2DM', criterionLabel: 'dx' }]
    expect(redactBlocks(blocks, { names: ['Vance'] }).blocks[0].criterionLabel).toBe('dx')
  })
})

describe('phiFromContext', () => {
  it('derives full name + parts, dropping middle initials, and keeps a real member id', () => {
    const phi = phiFromContext({
      patientName: 'Yvonne M. Castellano', patientDob: '1968-05-19', patientSex: 'F',
      memberId: 'CGN00456789', groupId: 'G', patientAddress: 'A',
      prescriberName: 'Dr X', prescriberNpi: '1', prescriberSpecialty: 'S',
      prescriberAddress: 'A', prescriberPhone: 'P',
    })
    expect(phi.names).toContain('Yvonne M. Castellano')
    expect(phi.names).toContain('Castellano')
    expect(phi.names).not.toContain('M.')
    expect(phi.memberId).toBe('CGN00456789')
  })

  it('omits placeholder member ids', () => {
    const phi = phiFromContext({
      patientName: 'Margaret Vance', patientDob: '—', patientSex: '—', memberId: '—',
      groupId: '—', patientAddress: '—', prescriberName: 'X', prescriberNpi: '1',
      prescriberSpecialty: 'S', prescriberAddress: 'A', prescriberPhone: 'P',
    })
    expect(phi.memberId).toBeUndefined()
  })
})

describe('the Build plane leaves no patient identifiers in a rendered golden document', () => {
  it('redacts every name and date in the Ozempic appeal source documents', () => {
    const client = initialClients.find(c => c.scenarioId === 'novo-ozempic')!
    const scenario = scenarios['novo-ozempic']
    const phi = phiFromContext(resolvePatientContext(scenario, client))
    const allBlocks = scenario.sourceDocuments!.flatMap(d => d.blocks)
    const { blocks, ledger } = redactBlocks(allBlocks, phi)

    expect(ledger.some(e => e.category === 'Date')).toBe(true)
    expect(ledger.some(e => e.category === 'Name')).toBe(true)

    const joined = blocks.map(b => b.text).join(' ')
    expect(joined).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/) // no unmasked dates
    expect(joined).not.toContain('Vance')                 // no surname leaks
  })
})
