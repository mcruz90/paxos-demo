import { type ScenarioConfig, type SourceDocument } from '../../types'
import { classifyDocumentKind } from './documentKind'

export type DocCategory = 'all' | 'clinical' | 'labs_meds' | 'held'

export interface CounterOfferComparison {
  orderedRegimen: string
  orderedClinicalBasis: string
  payerOfferRegimen: string
  payerOfferGap: string
  guidelineFloor: string
}

export function deriveCounterOfferComparison(
  scenario: ScenarioConfig | undefined,
): CounterOfferComparison | null {
  if (!scenario?.payerCounterOffer) return null
  const r2 = scenario.round2Appeal
  const orderedRegimen = r2?.requiredDose ?? `${scenario.requestedTherapy || scenario.drug}`
  const payerOfferRegimen = scenario.payerCounterOffer.approvedDose
  if (scenario.id === 'pediatric-esomeprazole') {
    return {
      orderedRegimen: 'Nexium 20mg/day oral suspension (≥20 kg pediatric dosing)',
      orderedClinicalBasis: 'Confirmed LA Grade B erosive esophagitis + swallowing-limitation bypass',
      payerOfferRegimen: '10mg/day partial approval (50% dose reduction)',
      payerOfferGap: 'Sub-therapeutic for child ≥20 kg — incomplete mucosal healing risk',
      guidelineFloor: `NASPGHAN/ESPGHAN 2018 (PMID ${r2?.guidelinePMID ?? '29470322'}) · 20mg/day labeled dose`,
    }
  }
  return {
    orderedRegimen,
    orderedClinicalBasis: scenario.diagnosis,
    payerOfferRegimen,
    payerOfferGap: scenario.payerCounterOffer.newDenialReason,
    guidelineFloor: r2?.guidelineRef ?? `${scenario.plan} clinical coverage criteria`,
  }
}

export function categorizeDocument(doc: SourceDocument): Exclude<DocCategory, 'all'> {
  if (doc.patientMismatchHold) return 'held'
  const kind = classifyDocumentKind(doc.source)
  if (kind === 'lab_report' || kind === 'medication_list') return 'labs_meds'
  if (/lab|pharmacy|rx|refill|imaging|chemistry|panel/i.test(`${doc.title} ${doc.source}`)) {
    return 'labs_meds'
  }
  return 'clinical'
}

export function filterDocumentsByCategory(
  docs: SourceDocument[],
  category: DocCategory,
): SourceDocument[] {
  if (category === 'all') return docs
  return docs.filter(d => categorizeDocument(d) === category)
}

export function countDocumentsByCategory(docs: SourceDocument[]): Record<DocCategory, number> {
  const counts: Record<DocCategory, number> = { all: docs.length, clinical: 0, labs_meds: 0, held: 0 }
  for (const d of docs) counts[categorizeDocument(d)] += 1
  return counts
}
