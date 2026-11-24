export interface SponsorBrand {
  id: string
  manufacturer: string
  drug: string
  approvalRate: number
  approvalTrend: number
  medianDaysToTherapy: number
  daysTrend: number
  sitesLive: number
  casesQuarter: number
  firstPassApprovedPct: number
  appealedPct: number
  postAppealApprovedPct: number
  denialReasons: { reason: string; pct: number; policyGapNote: string }[]
  byPayer: { payer: string; rate: number }[]
}

export interface SponsorFunnel {
  initialSubmitted: number
  firstPassApprovedPct: number
  appealedPct: number
  postAppealApprovedPct: number
  netAccessPct: number
  kAnonymityFloor: number
  phiIdentifiersCount: number
  illustrative: true
}

export const SPONSOR_BRANDS: SponsorBrand[] = [
  {
    id: 'gilead-livdelzi',
    manufacturer: 'Gilead Sciences',
    drug: 'Livdelzi (seladelpar)',
    approvalRate: 71,
    approvalTrend: 6,
    medianDaysToTherapy: 18,
    daysTrend: -4,
    sitesLive: 9,
    casesQuarter: 247,
    firstPassApprovedPct: 44,
    appealedPct: 48,
    postAppealApprovedPct: 56,
    denialReasons: [
      { reason: 'Disease-severity documentation incomplete (AASLD ≥2/3)', pct: 38, policyGapNote: 'Missing ALP + bilirubin serial trend at baseline' },
      { reason: 'Inadequate ursodiol (UDCA) ≥12m trial or intolerance', pct: 27, policyGapNote: 'Refill history unlinked from hepatology note' },
      { reason: 'Hepatology / GI specialist requirement unconfirmed', pct: 19, policyGapNote: 'Referring PCP signed instead of consulting GI' },
      { reason: 'Prior decompensation exclusion flag', pct: 16, policyGapNote: 'Conflicting ascites note vs. consult summary' },
    ],
    byPayer: [
      { payer: 'Aetna CVS Health', rate: 68 },
      { payer: 'UnitedHealthcare', rate: 74 },
      { payer: 'Cigna', rate: 70 },
      { payer: 'BCBS (multi-state)', rate: 73 },
    ],
  },
  {
    id: 'novo-ozempic',
    manufacturer: 'Novo Nordisk',
    drug: 'Ozempic (semaglutide)',
    approvalRate: 83,
    approvalTrend: 3,
    medianDaysToTherapy: 11,
    daysTrend: -2,
    sitesLive: 22,
    casesQuarter: 1840,
    firstPassApprovedPct: 68,
    appealedPct: 26,
    postAppealApprovedPct: 58,
    denialReasons: [
      { reason: 'Indication ambiguous (T2DM vs. weight management)', pct: 44, policyGapNote: 'BMI note triggers commercial obesity exclusion filter' },
      { reason: 'Concomitant GLP-1 / GIP agent active on med list', pct: 22, policyGapNote: 'Prior GLP-1 stop date not transmitted in PAS' },
      { reason: 'Quantity / titration step limit', pct: 18, policyGapNote: 'Maintenance dose submitted ahead of 4-week titration' },
      { reason: 'Plan formulary / prior-step missing', pct: 16, policyGapNote: 'Metformin / A1C labs attached on external PDF only' },
    ],
    byPayer: [
      { payer: 'Cigna', rate: 81 },
      { payer: 'Aetna CVS Health', rate: 79 },
      { payer: 'UnitedHealthcare', rate: 85 },
      { payer: 'Humana', rate: 86 },
    ],
  },
  {
    id: 'humira-cigna',
    manufacturer: 'AbbVie',
    drug: 'Humira (adalimumab)',
    approvalRate: 64,
    approvalTrend: 4,
    medianDaysToTherapy: 21,
    daysTrend: -5,
    sitesLive: 15,
    casesQuarter: 612,
    firstPassApprovedPct: 39,
    appealedPct: 52,
    postAppealApprovedPct: 48,
    denialReasons: [
      { reason: 'Non-preferred brand — preferred biosimilar trial missing', pct: 49, policyGapNote: 'IP0652 requires documented failure/intolerance of ≥1 biosimilar' },
      { reason: 'Conventional DMARD (MTX ≥12 wk) gap', pct: 24, policyGapNote: 'Pharmacy claims spans truncated across payer switches' },
      { reason: 'Baseline TB / Hepatitis B screening date expired', pct: 17, policyGapNote: 'QuantiFERON result > 12 months before renewal date' },
      { reason: 'Rheumatology disease activity score omitted', pct: 10, policyGapNote: 'CDAI / RAPID3 narrative missing in consult note' },
    ],
    byPayer: [
      { payer: 'Cigna', rate: 59 },
      { payer: 'UnitedHealthcare', rate: 67 },
      { payer: 'Aetna CVS Health', rate: 63 },
      { payer: 'BCBS (multi-state)', rate: 68 },
    ],
  },
  {
    id: 'pediatric-esomeprazole',
    manufacturer: 'AstraZeneca',
    drug: 'Nexium (esomeprazole) Susp.',
    approvalRate: 78,
    approvalTrend: 5,
    medianDaysToTherapy: 9,
    daysTrend: -3,
    sitesLive: 11,
    casesQuarter: 194,
    firstPassApprovedPct: 54,
    appealedPct: 39,
    postAppealApprovedPct: 62,
    denialReasons: [
      { reason: 'Tablet PPI step-therapy required (swallowing bypass missed)', pct: 46, policyGapNote: 'SLP dysphagia evaluation omitted from initial fax packet' },
      { reason: 'Partial approval duration cap (28 of 56 days)', pct: 29, policyGapNote: 'Policy states 12-month authorization; triggers Round 2 appeal / peer-to-peer' },
      { reason: 'Endoscopy / K21.0 erosive confirmation missing', pct: 15, policyGapNote: 'Procedure note attached separately from GI clinic note' },
      { reason: 'Conservative dietary trial documentation', pct: 10, policyGapNote: '≥2-week pediatric GERD conservative note buried in HPI' },
    ],
    byPayer: [
      { payer: 'UnitedHealthcare', rate: 76 },
      { payer: 'Cigna', rate: 80 },
      { payer: 'Aetna CVS Health', rate: 75 },
      { payer: 'Medicaid MCOs', rate: 81 },
    ],
  },
]

export function computeSponsorFunnel(brand: SponsorBrand): SponsorFunnel {
  return {
    initialSubmitted: brand.casesQuarter,
    firstPassApprovedPct: brand.firstPassApprovedPct,
    appealedPct: brand.appealedPct,
    postAppealApprovedPct: brand.postAppealApprovedPct,
    netAccessPct: brand.approvalRate,
    kAnonymityFloor: 10,
    phiIdentifiersCount: 0,
    illustrative: true,
  }
}
