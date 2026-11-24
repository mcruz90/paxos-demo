import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import type { components } from '../../generated/api-types'
import * as api from '../../lib/api'
import { CaseActionFooter } from './CaseActionFooter'
import { CaseQueueColumn } from './CaseQueueColumn'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import { type CriterionActions } from './CriterionRow'
import { EvidencePane } from './EvidencePane'
import { ExceptionResolverModal } from './ExceptionResolverModal'
import { patientForClient } from './patient'
import { PatientProfile } from './PatientProfile'
import { PreviewChecklistTab } from './PreviewChecklistTab'
import { PreviewPane } from './PreviewPane'
import previewPaneSource from './PreviewPane.tsx?raw'

type CaseAssessment = components['schemas']['CaseAssessment']

const SHA_GI = 'a'.repeat(64)
const SHA_SLP = 'b'.repeat(64)
const SHA_CTX = 'c'.repeat(64)
const SHA_REV = 'd'.repeat(64)
const UUID = '11111111-2222-4333-8444-555555555555'

const MIXED_ASSESSMENT: CaseAssessment = {
  revision: 1, ready: false, pathway: null, blockers: ['pantoprazole', 'feeding_tube', 'source_review'],
  policy_sha256: SHA_GI, age_years: 7,
  next_action: 'Document the reason for pantoprazole failure, contraindication, or intolerance.',
  findings: [
    { criterion_id: 'diagnosis', requirement: 'Diagnosis compatible with the pediatric GERD policy.', status: 'met', next_action: null,
      evidence: [{ source_version_id: 'gi-2026-10-21-v1', source_sha256: SHA_GI, start: 21, end: 37, role: 'patient', excerpt: 'Diagnosis: K21.0.' }] },
    { criterion_id: 'omeprazole', requirement: 'Documented failure, contraindication, or intolerance to prescription omeprazole with a stated reason.', status: 'met', next_action: null,
      evidence: [{ source_version_id: 'gi-2026-10-21-v1', source_sha256: SHA_GI, start: 38, end: 93, role: 'patient', excerpt: 'Prescription omeprazole: intolerance: witnessed choking.' }] },
    { criterion_id: 'pantoprazole', requirement: 'Documented failure, contraindication, or intolerance to pantoprazole with a stated reason.', status: 'missing',
      next_action: 'Document the reason for pantoprazole failure, contraindication, or intolerance.',
      evidence: [{ source_version_id: 'policy-ref-v1', source_sha256: SHA_CTX, start: 0, end: 42, role: 'context', excerpt: 'UHC PPI step-therapy policy excerpt only.' }] },
    { criterion_id: 'feeding_tube', requirement: 'Medication administration via feeding tube.', status: 'conflict',
      next_action: 'Reconcile the cited records for feeding tube.',
      evidence: [{ source_version_id: 'slp-2026-10-07-v1', source_sha256: SHA_SLP, start: 0, end: 45, role: 'patient', excerpt: 'Medications administered via feeding tube.' }] },
    { criterion_id: 'source_review', requirement: 'Clinical review of unrecognized chart statements.', status: 'missing',
      next_action: 'Review chart statements outside the supported observation format.',
      evidence: [{ source_version_id: 'chart-misc-v1', source_sha256: SHA_REV, start: 18, end: 64, role: 'patient', excerpt: null }] },
  ],
}

const READY_ASSESSMENT: CaseAssessment = {
  revision: 1, ready: true, pathway: 'swallowing', blockers: [], policy_sha256: SHA_GI, age_years: 7, next_action: null,
  findings: [MIXED_ASSESSMENT.findings[0], MIXED_ASSESSMENT.findings[1]],
}

const UNDER_SIX_ASSESSMENT: CaseAssessment = {
  revision: 1, ready: false, pathway: 'no_pa_required', blockers: [], policy_sha256: SHA_GI, age_years: 4,
  next_action: 'Ask the payer to reprocess the claim under the pediatric auto-process rule.',
  findings: [{ criterion_id: 'age', requirement: 'Patient age on the claim date of service.', status: 'met', next_action: null,
    evidence: [{ source_version_id: 'gi-2026-10-21-v1', source_sha256: SHA_GI, start: 0, end: 20, role: 'patient', excerpt: 'Age at request: 4 years.' }] }],
}

const noop = () => {}
const noopActions: CriterionActions = {
  stageDispatch: noop, cancelDispatch: noop, confirmDispatch: noop,
  startOverride: noop, cancelOverride: noop, applyOverride: noop, setOverrideInput: noop,
}
const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

afterEach(() => vi.unstubAllGlobals())

describe('G-06 assessment API client', () => {
  it('GETs /api/patients/{patient_ref}/cases/{case_id}/assessment with credentials', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(new Response(JSON.stringify(READY_ASSESSMENT), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const getAssessment = (api as unknown as { getCaseAssessment: (p: string, c: string) => Promise<CaseAssessment> }).getCaseAssessment
    expect(typeof getAssessment).toBe('function')
    const data = await getAssessment('PT-4201', UUID)
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/patients/PT-4201/cases/${UUID}/assessment`)
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include')
    expect(data.age_years).toBe(7)
  })
})

describe('G-06 checklist, resolver, evidence rail, footer, queue & age wiring', () => {
  const client = initialClients.find(c => c.scenarioId === 'pediatric-esomeprazole')!
  const scenario = scenarios['pediatric-esomeprazole']

  it('maps met/missing/conflict, shows criterion_id, separates payer requirement from finding, and keeps drug reason', () => {
    const html = renderToStaticMarkup(
      <PreviewChecklistTab
        activity={[]}
        sortedCriteria={[]}
        progress={{ satisfied: 0, total: 0, awaitingDocs: 0 }}
        localState={EMPTY_LOCAL_CASE_STATE}
        actions={noopActions}
        selectedCiteIndex={null}
        onSelectCiteIndex={noop}
        {...({ assessment: MIXED_ASSESSMENT } as Record<string, unknown>)}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('diagnosis')
    expect(text).toContain('omeprazole')
    expect(text).toContain('pantoprazole')
    expect(text).toContain('feeding_tube')
    expect(text).toContain('✓ Met')
    expect(text).toContain('Missing')
    expect(text).toContain('Conflict')
    expect(text).toContain('Payer requirement:')
    expect(text).toContain('Patient finding:')
    expect(text).toContain('Prescription omeprazole: intolerance: witnessed choking.')
  })

  it('shows location only with offsets and no text for source_review, and opens source version at offsets', () => {
    const html = renderToStaticMarkup(
      <EvidencePane
        scenario={scenario}
        phi={null}
        showCitations={true}
        onToggleCitations={noop}
        citeView="source"
        setCiteView={noop}
        activeCiteIndex={null}
        onSelectCiteIndex={noop}
        activeDocId={null}
        onSelectDoc={noop}
        {...({
          assessment: MIXED_ASSESSMENT,
          sourceBodies: { 'gi-2026-10-21-v1': 'Age at request: 7.\n\nDiagnosis: K21.0.\nPrescription omeprazole: intolerance: witnessed choking.' },
        } as Record<string, unknown>)}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('gi-2026-10-21-v1')
    expect(text).toContain('chart-misc-v1')
    expect(text).toContain('18..64')
    expect(text.toLowerCase()).toContain('location only')
    expect(text).toContain('Prescription omeprazole: intolerance: witnessed choking.')
  })

  it('shows backend next_action and blocker in resolver, and marks context evidence as context never proof', () => {
    const html = renderToStaticMarkup(
      <ExceptionResolverModal
        ctx={{
          title: 'Resolve exception — pantoprazole',
          gapSummary: 'Documented failure, contraindication, or intolerance to pantoprazole with a stated reason.',
          policyNote: 'Documented failure, contraindication, or intolerance to pantoprazole with a stated reason.',
          options: [],
          guidelineHits: [],
          ...({
            criterionId: 'pantoprazole',
            isBlocker: true,
            backendNextAction: 'Document the reason for pantoprazole failure, contraindication, or intolerance.',
            contextEvidence: MIXED_ASSESSMENT.findings[2].evidence,
          } as Record<string, unknown>),
        }}
        applyLabel="Apply Resolution"
        onApply={noop}
        onClose={noop}
      />,
    )
    const text = visibleText(html)
    expect(text).toContain('Blocker')
    expect(text).toContain('Document the reason for pantoprazole failure, contraindication, or intolerance.')
    expect(text).toContain('Context only (not proof)')
    expect(text).toContain('UHC PPI step-therapy policy excerpt only.')
  })

  it('drives footer and queue from backend readiness without calling ready approved, and handles under-6 no_pa_required', () => {
    expect(previewPaneSource).toContain('deriveReadinessGate')
    const previewHtml = visibleText(renderToStaticMarkup(
      <PreviewPane
        client={{ ...client, status: 'ready_for_review' }} scenario={scenario} localState={EMPTY_LOCAL_CASE_STATE}
        actions={noopActions} onQuickApprove={noop} onPayerDecision={noop} selectedCiteIndex={null} onSelectCiteIndex={noop}
        activeTab="checklist" setActiveTab={noop} activeDocId={null} onViewDoc={noop} generateCap="simulated" assessment={READY_ASSESSMENT}
      />,
    ))
    expect(previewHtml).toContain('Ready — not approved')
    expect(previewHtml).not.toContain('Approved')
    const readyFooter = visibleText(renderToStaticMarkup(
      <CaseActionFooter
        client={{ ...client, status: 'ready_for_review' }}
        scenario={scenario}
        hasUnresolvedRemaining={true}
        letterOnScreen={true}
        letterReviewed={true}
        onPrint={noop}
        onQuickApprove={noop}
        onGoToLetter={noop}
        onViewActivity={noop}
        {...({ assessment: READY_ASSESSMENT } as Record<string, unknown>)}
      />,
    ))
    expect(readyFooter).toContain('Ready — not approved')
    expect(readyFooter).not.toContain('Approved')

    const under6Footer = visibleText(renderToStaticMarkup(
      <CaseActionFooter
        client={client}
        scenario={scenario}
        hasUnresolvedRemaining={false}
        letterOnScreen={false}
        letterReviewed={false}
        onPrint={noop}
        onQuickApprove={noop}
        onGoToLetter={noop}
        onViewActivity={noop}
        {...({ assessment: UNDER_SIX_ASSESSMENT } as Record<string, unknown>)}
      />,
    ))
    expect(under6Footer).toContain('Ask the payer to reprocess the claim under the pediatric auto-process rule.')
    expect(under6Footer).toContain('No PA required for this request')
    expect(under6Footer).not.toMatch(/under-6/i)
    expect(under6Footer).not.toContain('Approve & File Prior Auth')

    const under6Strip = visibleText(renderToStaticMarkup(
      <CaseActionFooter
        client={client}
        scenario={scenario}
        hasUnresolvedRemaining={false}
        letterOnScreen={true}
        letterReviewed={false}
        onPrint={noop}
        onQuickApprove={noop}
        onGoToLetter={noop}
        onViewActivity={noop}
        {...({ assessment: UNDER_SIX_ASSESSMENT } as Record<string, unknown>)}
      />,
    ))
    expect(under6Strip).toContain('No PA required for this request')
    expect(under6Strip).not.toMatch(/under-6/i)

    const queueText = visibleText(renderToStaticMarkup(
      <CaseQueueColumn
        clients={[client]}
        groups={[{ status: client.status, label: 'Respond to payer', hint: 'hint', rows: [client] }]}
        search=""
        setSearch={noop}
        filterStage="all"
        setFilterStage={noop}
        filterUrgency="all"
        setFilterUrgency={noop}
        selectedId={null}
        onSelect={noop}
        isClientExceptionsResolved={() => false}
        {...({ assessmentsByScenario: { 'pediatric-esomeprazole': READY_ASSESSMENT } } as Record<string, unknown>)}
      />,
    ))
    expect(queueText).toContain('Ready — not approved')
    expect(queueText).toContain('2/2 Met')
  })

  it('shows backend age_years (on claim date of service) and Not determined when null in Storyboard', () => {
    const withAge = visibleText(renderToStaticMarkup(
      <PatientProfile
        patient={patientForClient(initialClients, client)}
        scenario={scenario}
        activeScenarioId={client.scenarioId}
        clients={[client]}
        onSelectClient={noop}
        onSelectCase={noop}
        onBackToQueue={noop}
        workspace={<div />}
        {...({ assessment: READY_ASSESSMENT } as Record<string, unknown>)}
      />,
    ))
    expect(withAge).toContain('Age at request: 7 years')

    const withNullAge = visibleText(renderToStaticMarkup(
      <PatientProfile
        patient={patientForClient(initialClients, client)}
        scenario={scenario}
        activeScenarioId={client.scenarioId}
        clients={[client]}
        onSelectClient={noop}
        onSelectCase={noop}
        onBackToQueue={noop}
        workspace={<div />}
        {...({ assessment: { ...READY_ASSESSMENT, age_years: null } } as Record<string, unknown>)}
      />,
    ))
    expect(withNullAge).toContain('Age at request: Not determined')
  })
})
