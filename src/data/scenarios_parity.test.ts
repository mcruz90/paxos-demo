/**
 * Anchor-join parity guard — Slice 6, Sprint 1.
 *
 * Joins backend/evals/fixtures/scenarios.json (golden labels) with the
 * frontend scenarios map (src/data/scenarios.tsx) on the ANCHOR key and
 * asserts that anchor-level facts agree:
 *   - drug name (primary name before parenthetical)
 *   - submitted ICD-10 code appears in frontend diagnosis string
 *   - payer/plan name
 *   - configFile routing
 *
 * NOT tested here (diverge by design):
 *   - per-scenario ids (golden: ozempic_cigna_clinical_pa; frontend: novo-ozempic)
 *   - per-criterion narrative text
 *
 * This guard caught the K75.89 → K74.3 PBC ICD-10 bug and must catch
 * any future anchor-level drift between the golden set and the frontend.
 */

import { describe, it, expect } from 'vitest'
import { initialClients, scenarios } from './scenarios'
import goldenRaw from '../../backend/evals/fixtures/scenarios.json'

// ---------------------------------------------------------------------------
// Load the golden scenarios fixture (static JSON import via Vite bundler)
// ---------------------------------------------------------------------------

interface GoldenCriteria {
  key: string
  rule_type: string
  ground_truth_status: string
}

interface GoldenSubmittedCodes {
  icd10: string[]
  ndc?: string
}

interface GoldenExpectedOutcome {
  appealable: boolean
  resolution_path: string
  primary_argument_key: string | null
  confidence: string
}

interface GoldenScenario {
  scenario_id: string
  anchor_id: string
  denial_type: string
  drug: string
  payer: string
  plan_id: string
  submitted_codes: GoldenSubmittedCodes
  criteria: GoldenCriteria[]
  expected_outcome: GoldenExpectedOutcome
}

interface GoldenFixture {
  schema_version: string
  scenarios: GoldenScenario[]
}

const _golden = goldenRaw as unknown as GoldenFixture

// ---------------------------------------------------------------------------
// Canonical anchor → frontend scenario key mapping
// Only the three primary anchors (one per drug); clinical_pa scenarios only.
// ---------------------------------------------------------------------------

const ANCHOR_JOIN: Array<{
  anchorId: string
  frontendKey: string
  configFile: string
}> = [
  {
    anchorId: 'ozempic_cigna',
    frontendKey: 'novo-ozempic',
    configFile: 'ozempic_cigna_base.json',
  },
  {
    anchorId: 'esomeprazole_uhc_pediatric',
    frontendKey: 'pediatric-esomeprazole',
    configFile: 'esomeprazole_uhc_pediatric.json',
  },
  {
    anchorId: 'livdelzi_cigna_hepatology',
    frontendKey: 'gilead-livdelzi',
    configFile: 'livdelzi_cigna_hepatology.json',
  },
  {
    anchorId: 'humira_cigna',
    frontendKey: 'humira-cigna',
    configFile: 'humira_cigna_ip0652.json',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function goldenClinicalPaFor(anchorId: string): GoldenScenario {
  const s = _golden.scenarios.find(
    (x) => x.anchor_id === anchorId && x.denial_type === 'clinical_pa',
  )
  if (!s) throw new Error(`No clinical_pa scenario for anchor ${anchorId}`)
  return s
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Anchor-join parity: golden scenarios.json ↔ frontend scenarios.tsx', () => {
  it('ANCHOR_JOIN covers every clinical_pa anchor in the golden set (fails closed on drift)', () => {
    // If a new anchor is added on the backend without a matching ANCHOR_JOIN
    // entry here, this must fail loudly instead of the new anchor silently
    // skipping every check below.
    const goldenAnchors = new Set(
      _golden.scenarios
        .filter((s) => s.denial_type === 'clinical_pa')
        .map((s) => s.anchor_id),
    )
    const joinedAnchors = new Set(ANCHOR_JOIN.map((a) => a.anchorId))
    expect(joinedAnchors).toEqual(goldenAnchors)
  })

  for (const { anchorId, frontendKey, configFile } of ANCHOR_JOIN) {
    const golden = goldenClinicalPaFor(anchorId)
    const fe = scenarios[frontendKey]

    describe(`anchor=${anchorId}`, () => {
      it('frontend scenario key is defined', () => {
        expect(fe).toBeDefined()
      })

      it('configFile routing matches', () => {
        expect(fe.configFile).toBe(configFile)
      })

      it('primary drug name agrees (brand name, first word)', () => {
        // Compare the first word of the drug string — the brand name.
        // Robust to format differences like "Nexium for Oral Suspension (esomeprazole)"
        // vs "Nexium (esomeprazole) 10mg..." — both brand names are "nexium".
        const goldenBrand = golden.drug.split(/[\s(]/)[0].toLowerCase()
        const feBrand = fe.drug.split(/[\s(]/)[0].toLowerCase()
        expect(feBrand).toBe(goldenBrand)
      })

      it('submitted ICD-10 code appears in frontend diagnosis string', () => {
        const icd = golden.submitted_codes.icd10[0]
        expect(fe.diagnosis).toContain(icd)
      })

      it('payer name agrees (case-insensitive first word)', () => {
        // Cigna Healthcare PPO vs "Cigna Connect 500 PPO" — both start with "Cigna".
        // UHC vs "UnitedHealthcare Choice Plus" — golden payer starts with "United".
        // Compare first word only: robust to plan-name variants.
        const goldenFirst = golden.payer.split(' ')[0].toLowerCase()
        const feFirst = fe.plan.split(' ')[0].toLowerCase()
        expect(feFirst).toBe(goldenFirst)
      })

      it('plan_id agrees', () => {
        expect(fe.planId).toBe(golden.plan_id)
      })
    })
  }
})

// ---------------------------------------------------------------------------
// Client ↔ scenario identity consistency.
//
// A scenario's authored narrative (criterion notes, citation snippets,
// source-document blocks) may state the patient's DOB. Every queue client
// bound to that scenario must carry the SAME DOB — the patient banner and the
// rendered chart sit on one screen, so a mismatch is a visible contradiction
// (this guard was added after Case #PH-3102 shipped with a banner DOB of
// 11/08/1967 over documents stating 03/14/1972).
// ---------------------------------------------------------------------------

describe('client DOB agrees with every DOB the scenario narrative states', () => {
  const DOB_RE = /DOB (\d{2}\/\d{2}\/\d{4})/g

  const narrativeDobs = (scenarioId: string): string[] => {
    const s = scenarios[scenarioId]
    const texts = [
      ...s.criteriaResults.map(c => c.note),
      ...Object.values(s.citations).map(c => c.text),
      ...(s.sourceDocuments ?? []).flatMap(d => d.blocks.map(b => b.text)),
    ]
    return [...new Set(texts.flatMap(t => [...t.matchAll(DOB_RE)].map(m => m[1])))]
  }

  for (const client of initialClients) {
    const stated = narrativeDobs(client.scenarioId)
    if (stated.length === 0 || !client.patientDob) continue
    it(`${client.name} (${client.patientDisplayName}) matches ${client.scenarioId}`, () => {
      expect(stated).toEqual([client.patientDob])
    })
  }
})
