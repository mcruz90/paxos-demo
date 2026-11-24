import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from '../../data/scenarios'
import type { components } from '../../generated/api-types'
import { CaseActionFooter } from './CaseActionFooter'
import { CaseQueueColumn } from './CaseQueueColumn'
import { EMPTY_LOCAL_CASE_STATE } from './caseQueue'
import { type CriterionActions } from './CriterionRow'
import { EvidencePane } from './EvidencePane'
import { PreviewPane } from './PreviewPane'

type CaseAssessment = components['schemas']['CaseAssessment']
type CaseAttachment = components['schemas']['CaseAttachment']
type DiscoveryResults = components['schemas']['DiscoveryResults']
type FullTextResult = components['schemas']['FullTextResult']
type MetadataResult = components['schemas']['MetadataResult']

const SHA_1 = 'a'.repeat(64)
const SHA_2 = 'b'.repeat(64)
const QUERY_ID = '22222222-3333-4444-8555-666666666666'
const RESULT_FULL = '33333333-4444-4555-8666-777777777777'
const RESULT_META = '44444444-5555-4666-8777-888888888888'
const ATTACH_ID = '55555555-6666-4777-8888-999999999999'

const FULL_TEXT_ITEM: FullTextResult = {
  availability: 'full_text',
  category: 'clinical_note',
  content_sha256: SHA_1,
  start: 12,
  end: 30,
  excerpt: 'Esomeprazole 20 mg',
  result_id: RESULT_FULL,
  source_id: 'epic-gi-consult',
  source_version_id: 'gi-note-v3',
  title: 'Pediatric GI Consult Note',
}

const METADATA_ITEM: MetadataResult = {
  availability: 'metadata_only',
  category: 'document_index',
  content_sha256: SHA_2,
  start: null,
  end: null,
  excerpt: null,
  result_id: RESULT_META,
  source_id: 'careeverywhere-index',
  source_version_id: 'ext-index-v1',
  title: 'External Endoscopy Summary (Index)',
}

const DISCOVERY_RESULTS: DiscoveryResults = {
  query_id: QUERY_ID,
  query: 'esomeprazole',
  revision: 2,
  items: [FULL_TEXT_ITEM, METADATA_ITEM],
}

const ATTACHED_FULL: CaseAttachment = {
  attachment_id: ATTACH_ID,
  actor_id: 'dr.patel',
  attached_at: '2026-11-22T15:10:00Z',
  item: FULL_TEXT_ITEM,
}

const BASE_ASSESSMENT: CaseAssessment = {
  revision: 2,
  ready: false,
  pathway: null,
  blockers: ['pantoprazole'],
  policy_sha256: SHA_1,
  age_years: 7,
  next_action: 'Document pantoprazole intolerance.',
  findings: [
    {
      criterion_id: 'diagnosis',
      requirement: 'GERD diagnosis.',
      status: 'met',
      next_action: null,
      evidence: [{ source_version_id: 'gi-note-v3', source_sha256: SHA_1, start: 0, end: 12, role: 'patient', excerpt: 'GERD K21.0.' }],
    },
    {
      criterion_id: 'pantoprazole',
      requirement: 'Pantoprazole trial or contraindication.',
      status: 'missing',
      next_action: 'Document pantoprazole intolerance.',
      evidence: [],
    },
  ],
}

const noop = () => {}
const asyncNoop = async () => {}
const noopActions: CriterionActions = {
  stageDispatch: noop, cancelDispatch: noop, confirmDispatch: noop,
  startOverride: noop, cancelOverride: noop, applyOverride: noop, setOverrideInput: noop,
}
const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

describe('G-07 discovery rail UI, Unicode slicing, errors, and readiness isolation', () => {
  const client = initialClients.find(c => c.scenarioId === 'pediatric-esomeprazole')!
  const scenario = scenarios['pediatric-esomeprazole']

  const makeRailProps = (overrides: Record<string, unknown> = {}) => ({
    queryInput: 'esomeprazole',
    setQueryInput: noop,
    results: DISCOVERY_RESULTS,
    attachments: [] as CaseAttachment[],
    attachmentsError: null as string | null,
    discoveryError: null as string | null,
    actionError: null as string | null,
    isSearching: false,
    isLoadingAttachments: false,
    busyActionKey: null as string | null,
    inspectedItem: null as FullTextResult | MetadataResult | null,
    onInspectItem: noop,
    onSearch: asyncNoop,
    onAttach: asyncNoop,
    onRemove: asyncNoop,
    ...overrides,
  })

  const renderRail = (discoveryOverrides: Record<string, unknown> = {}, sourceBodies?: Record<string, string>) =>
    renderToStaticMarkup(
      <EvidencePane
        scenario={scenario}
        phi={null}
        showCitations={true}
        onToggleCitations={noop}
        citeView="discovery"
        setCiteView={noop}
        activeCiteIndex={null}
        onSelectCiteIndex={noop}
        activeDocId={null}
        onSelectDoc={noop}
        assessment={BASE_ASSESSMENT}
        sourceBodies={sourceBodies}
        discovery={makeRailProps(discoveryOverrides)}
      />,
    )

  it('lists discovery results (source, category, version, availability) and disables Find evidence while in-flight', () => {
    const text = visibleText(renderRail({ isSearching: false }))
    expect(text).toContain('Find evidence')
    expect(text).toContain('epic-gi-consult')
    expect(text).toContain('clinical_note')
    expect(text).toContain('gi-note-v3')
    expect(text).toContain('careeverywhere-index')
    expect(text).toContain('document_index')
    expect(text).toContain('ext-index-v1')

    const searchingHtml = renderRail({ isSearching: true })
    expect(searchingHtml).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*?Find evidence/)
  })

  it('renders metadata_only as "metadata only: not read" with no excerpt even if sourceBodies exists', () => {
    const text = visibleText(renderRail({ inspectedItem: METADATA_ITEM }, { 'ext-index-v1': 'SECRET UNREAD TEXT MUST NOT APPEAR' }))
    expect(text.toLowerCase()).toContain('metadata only: not read')
    expect(text).not.toContain('SECRET UNREAD TEXT MUST NOT APPEAR')
  })

  it('inspects full_text using Unicode code-point slicing with characters outside the BMP', () => {
    // '🩺' and '🎉' are surrogate pairs (2 UTF-16 code units each, 1 code point each).
    const nonBmpBody = '🩺🎉 Patient: Esomeprazole 20 mg daily x 56 days.'
    const html = renderRail({ inspectedItem: FULL_TEXT_ITEM }, { 'gi-note-v3': nonBmpBody })
    expect(html).toContain('<mark')
    const markMatch = html.match(/<mark[^>]*>([\s\S]*?)<\/mark>/)
    expect(markMatch?.[1]).toBe('Esomeprazole 20 mg')
  })

  it('renders attached items (source, version, span, actor, time) and Remove control', () => {
    const text = visibleText(renderRail({ attachments: [ATTACHED_FULL] }))
    expect(text).toContain('Attached Evidence')
    expect(text).toContain('epic-gi-consult')
    expect(text).toContain('gi-note-v3')
    expect(text).toContain('12..30')
    expect(text).toContain('dr.patel')
    expect(text).toContain('2026-11-22T15:10:00Z')
    expect(text).toContain('Remove')
  })

  it('renders 409 as "the case changed: reload" and 404 as "not available" (never empty list)', () => {
    const errText = visibleText(renderRail({ results: null, attachments: [], attachmentsError: 'not available', actionError: 'the case changed: reload' }))
    expect(errText).toContain('the case changed: reload')
    expect(errText).toContain('not available')
    expect(errText).not.toContain('No evidence attached to this case yet')
  })

  it('shows "run the search again" when no query results are loaded', () => {
    const text = visibleText(renderRail({ results: null }))
    expect(text.toLowerCase()).toContain('run the search again')
  })

  it('leaves readiness unchanged after attaching evidence and states reassessment is "not built"', () => {
    const railText = visibleText(renderRail({ attachments: [ATTACHED_FULL] }))
    expect(railText.toLowerCase()).toContain('not built')

    const previewText = visibleText(
      renderToStaticMarkup(
        <PreviewPane
          client={client} scenario={scenario} localState={EMPTY_LOCAL_CASE_STATE} actions={noopActions}
          onQuickApprove={noop} onPayerDecision={noop} selectedCiteIndex={null} onSelectCiteIndex={noop}
          activeTab="checklist" setActiveTab={noop} activeDocId={null} onViewDoc={noop}
          generateCap="simulated" assessment={BASE_ASSESSMENT}
        />,
      ),
    )
    const footerText = visibleText(
      renderToStaticMarkup(
        <CaseActionFooter
          client={client} scenario={scenario} hasUnresolvedRemaining={true} letterOnScreen={false} letterReviewed={false}
          onPrint={noop} onQuickApprove={noop} onGoToLetter={noop} onViewActivity={noop} assessment={BASE_ASSESSMENT}
        />,
      ),
    )
    const queueText = visibleText(
      renderToStaticMarkup(
        <CaseQueueColumn
          clients={[client]} groups={[{ status: client.status, label: 'Respond to payer', hint: 'hint', rows: [client] }]}
          search="" setSearch={noop} filterStage="all" setFilterStage={noop} filterUrgency="all" setFilterUrgency={noop}
          selectedId={null} onSelect={noop} isClientExceptionsResolved={() => false}
          assessmentsByScenario={{ 'pediatric-esomeprazole': BASE_ASSESSMENT }}
        />,
      ),
    )

    expect(previewText).toContain('1/2 Criteria Met · Blocked — review required')
    expect(footerText).toMatch(/Blocked\s*:\s*pantoprazole/)
    expect(queueText).toContain('1/2 Met')
    expect(queueText).toContain('Blocked — review required')
  })
})
