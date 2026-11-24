import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { initialClients, scenarios } from './scenarios'
import { getSamplePayloadPreview } from '../components/onboardingData'
import { CaseContextSidebar } from '../components/poc/CaseContextSidebar'
import { type PocContextValue, PocProvider } from '../components/poc/PocContext'
import { Round2DonePanel } from '../components/poc/Round2DonePanel'
import { Round2SubmittedPanel } from '../components/poc/Round2SubmittedPanel'
import { SubmittedPanel } from '../components/poc/SubmittedPanel'
import { CaseActionFooter } from '../components/portfolio/CaseActionFooter'
import { ACTION_GROUPS, tourIdFor } from '../components/portfolio/caseQueue'
import { PayerCounterOfferBanner } from '../components/portfolio/PayerCounterOfferBanner'
import { ensureSourceDocuments } from '../components/portfolio/sourceDocuments'

const visibleText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

const noop = () => {}

function makePocValue(scenario: (typeof scenarios)[string]): PocContextValue {
  return {
    scenario,
    onReset: noop,
    phase: 'submitted',
    setPhase: noop,
    dispatched: [],
    pendingDispatch: [],
    acknowledged: true,
    setAcknowledged: noop,
    appealRef: 'APL-4201',
    traceOpen: false,
    setTraceOpen: noop,
    hoveredCite: null,
    setHoveredCite: noop,
    editMode: false,
    setEditMode: noop,
    editedBody: null,
    setEditedBody: noop,
    round2Loading: false,
    round2StepIdx: 0,
    round2TourIdx: 0,
    setRound2TourIdx: noop,
    payerResponseResolution: null,
    setPayerResponseResolution: noop,
    overrides: {},
    pendingOverride: null,
    setPendingOverride: noop,
    overrideInput: '',
    setOverrideInput: noop,
    stepIdx: 0,
    tourIdx: 0,
    setTourIdx: noop,
    letterDate: '2026-11-13',
    pipelineSteps: [],
    unresolvedCriteria: [],
    satisfiedCriteria: scenario.criteriaResults,
    allResolved: true,
    generateLetterBody: () => '',
    handleRound2Execute: noop,
    confirmDispatch: noop,
    cancelPendingDispatch: noop,
    stagePendingDispatch: noop,
    dispatchAll: noop,
    applyOverride: noop,
    handleExecute: noop,
    handleDownload: noop,
  }
}

describe('G-06 pediatric Nexium anchor story, planId, under-6 removal, and tour id', () => {
  const client = initialClients.find(c => c.scenarioId === 'pediatric-esomeprazole')!
  const scenario = scenarios['pediatric-esomeprazole']

  it('renames tour-case-infant to tour-case-pediatric and updates planId to UHC-CHOICE-2026', () => {
    expect(tourIdFor(client)).toBe('tour-case-pediatric')
    expect(tourIdFor(client)).not.toBe('tour-case-infant')
    expect(scenario.planId).toBe('UHC-CHOICE-2026')
    expect(getSamplePayloadPreview('meridian-health').normalizedJson.plan_id).toBe('UHC-CHOICE-2026')
  })

  it('removes the UI copy of auto_process_rule under_age 6 from scenario configJson', () => {
    expect(scenario.configJson).not.toContain('auto_process_rule')
    expect(scenario.configJson).not.toContain('under_age')
  })

  it('reflects the May 2026-11-21 Oct-Nov 2026 duration story and removes all legacy dose/label claims', () => {
    expect(client.patientDob).toBe('01/15/2019')

    const sidebarText = visibleText(renderToStaticMarkup(<CaseContextSidebar scenario={scenario} />))
    const submittedText = visibleText(
      renderToStaticMarkup(
        <PocProvider value={makePocValue(scenario)}>
          <SubmittedPanel />
        </PocProvider>,
      ),
    )
    const bannerText = visibleText(
      renderToStaticMarkup(
        <PayerCounterOfferBanner offer={scenario.payerCounterOffer!} scenario={scenario} onDispute={() => {}} onAccept={() => {}} />,
      ),
    )
    const pocHtml = visibleText(
      renderToStaticMarkup(
        <PocProvider value={makePocValue(scenario)}>
          <CaseContextSidebar scenario={scenario} />
          <SubmittedPanel />
          <Round2DonePanel />
          <Round2SubmittedPanel />
        </PocProvider>,
      ),
    )
    const portfolioHtml = visibleText(
      renderToStaticMarkup(
        <>
          <PayerCounterOfferBanner offer={scenario.payerCounterOffer!} scenario={scenario} onDispute={() => {}} onAccept={() => {}} />
          <CaseActionFooter
            client={client}
            scenario={scenario}
            hasUnresolvedRemaining={false}
            letterOnScreen={false}
            letterReviewed={false}
            onPrint={() => {}}
            onQuickApprove={() => {}}
            onGoToLetter={() => {}}
            onViewActivity={() => {}}
          />
        </>,
      ),
    )
    const queueHint = ACTION_GROUPS.find(g => g.status === 'payer_response')?.hint ?? ''
    const sourceTitles = ensureSourceDocuments(scenario).map(d => d.title).join(' ')

    const combined = [
      client.gapSummary ?? '',
      JSON.stringify(scenario),
      pocHtml,
      portfolioHtml,
      queueHint,
      sourceTitles,
    ].join(' ')

    expect(combined).toContain('23 kg')
    expect(combined).toContain('28 of 56 days')
    expect(combined).toContain('peer-to-peer')
    expect(combined).toContain('12 months')
    expect(sidebarText).toContain('The appeal cites the policy')
    expect(sidebarText).toContain('prescribed 56-day course')
    expect(submittedText).toContain('Prescribed 56-day course')
    expect(bannerText).toContain('Payer Partial Approval')
    expect(bannerText).toContain('Accept Partial Approval')
    expect(scenario.round2Appeal?.guidelinePMID).toBeUndefined()
    expect(scenario.round2Appeal?.guidelineRef).toBeUndefined()

    const forbidden = [
      /below the labeled dose/i,
      /sub-?therapeutic/i,
      /10\s?mg\/day/i,
      /50% dose reduction/i,
      /50% below requested dose/i,
      /UHC-CHOICE-2024/,
      /05\/30\/2019/,
      /tour-case-infant/,
      /29470322/,
      /NASPGHAN/i,
      /ESPGHAN/i,
      /8-week/i,
      /grounded in policy/i,
      /conflicts with/i,
      /counter-offer/i,
      /Accept Offer/i,
    ]
    for (const pattern of forbidden) {
      expect(combined).not.toMatch(pattern)
    }
  })
})
