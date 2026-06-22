import type { ScenarioConfig } from '../../types'

export interface PipelineStep {
  label: string
  loadingText: string
  explanation: string
}

export function getPipelineSteps(scenario: ScenarioConfig): PipelineStep[] {
  // Initial PA = assemble & transmit a NEW request. Same 4-node engine, framed as
  // the Da Vinci CRD → DTR → (assemble) → PAS lifecycle. Artifact is a structured
  // PA request (questionnaire + FHIR/X12-278 bundle), not a free-text appeal.
  if (scenario.lifecycle === 'initial_pa') {
    return [
      {
        label: 'Ingestion',
        loadingText: `Parsing the order and checking whether ${scenario.plan} requires a PA...`,
        explanation: `Parsed the inbound order for ${scenario.drug} from the EHR. Ran the Da Vinci CRD (Coverage Requirements Discovery) pre-check against ${scenario.plan}: a prior authorization IS required for GLP-1 agonists on this plan. Extracted drug, diagnosis (T2DM, E11.9), and the documentation the payer's PA policy will demand — before any letter is written.`,
      },
      {
        label: 'Retrieval',
        loadingText: `Resolving the policy pack and gathering required documentation...`,
        explanation: `Resolved the ${scenario.plan} GLP-1 policy pack from the registry (BIN/PCN/Group). Ran the Da Vinci DTR (Documentation Templates & Rules) step: pulled the payer's PA questionnaire and auto-answered each item from the patient chart — confirmed T2DM, HbA1c on regimen, ≥90 days of Metformin, and the MTC safety screen. Every answer is bound to a source document.`,
      },
      {
        label: 'Synthesis',
        loadingText: 'Assembling the structured PA request (questionnaire + FHIR bundle)...',
        explanation: `Assembled the structured prior-authorization request: the completed DTR questionnaire plus a FHIR bundle (X12 278 equivalent) carrying the requested therapy and supporting evidence. Generated a human-readable summary alongside the machine payload so the coordinator reviews exactly what the payer will receive. No claim appears that is not traceable to the chart.`,
      },
      {
        label: 'Gatekeeper',
        loadingText: 'Schema-validating the PAS payload (no LLM)...',
        explanation: `Ran deterministic schema validation on the PAS payload without any AI model: required FHIR fields present, every questionnaire item answered, requested drug/dose well-formed, and each answer carries a source citation. All checks passed. The request is ready for the PA Coordinator's authorization before it transmits to ${scenario.plan} via Da Vinci PAS.`,
      },
    ]
  }
  const isInfant = scenario.id === 'infant-omeprazole'
  return [
    {
      label: 'Ingestion',
      loadingText: isInfant
        ? 'Parsing UHC denial for omeprazole suspension...'
        : `Parsing ${scenario.plan} denial for ${scenario.drug}...`,
      explanation: isInfant
        ? `Parsed the UnitedHealthcare denial for omeprazole oral suspension. Identified the denial as a formulary exception request — the payer requires step therapy with a tablet or H2 blocker before approving a compounded liquid. Extracted patient age (4 months), diagnosis (infantile GERD, K21.0), and the formulary alternative the payer cited.`
        : `Parsed the ${scenario.plan} denial for ${scenario.drug} (semaglutide). Identified the denial as a step therapy requirement: the payer claims insufficient documentation that the patient trialed Metformin before escalating to a GLP-1 agonist. Extracted drug, diagnosis (T2DM, E11.9), and the four PA criteria to satisfy.`,
    },
    {
      label: 'Retrieval',
      loadingText: isInfant
        ? 'Loading pediatric GI policy + FDA safety database...'
        : `Loading ${scenario.plan} PA policy for GLP-1 agonists...`,
      explanation: isInfant
        ? `Loaded UHC's pediatric GI formulary criteria. Critically, also retrieved the FDA's April 2020 ranitidine (Zantac) market withdrawal notice — establishing that the payer's preferred H2 blocker alternative is no longer legally available in the US due to NDMA contamination. The step therapy path the payer requires does not exist.`
        : `Loaded ${scenario.plan}'s PA policy for GLP-1 agonists. Retrieved 4 criteria to satisfy: confirmed T2DM diagnosis, HbA1c ≥ 7.5% on current regimen, ≥ 90 days of Metformin at maximum tolerated dose, and no history of medullary thyroid carcinoma. Cross-referenced each against the patient's submitted records.`,
    },
    {
      label: 'Synthesis',
      loadingText: 'Drafting evidence-grounded appeal letter...',
      explanation: isInfant
        ? `Generated an appeal making two independent arguments that can't be simultaneously refuted: (1) the patient is 4 months old — solid tablet formulations are physically impossible to administer; (2) the formulary H2 alternative (ranitidine) was withdrawn by the FDA due to NDMA contamination and cannot be trialed. Cited NASPGHAN 2018 pediatric GERD guidelines (PMID 29470322) for dosing standards.`
        : `Generated an appeal letter grounded in all 4 PA criteria. Confirmed T2DM via endocrinology consult (HbA1c 8.2%, threshold 7.5%). Documented 112 consecutive days of Metformin 1000mg BID from pharmacy fill records — exceeding the 90-day threshold. Safety check clear. Every claim traces to a source document; no unsupported assertions.`,
    },
    {
      label: 'Gatekeeper',
      loadingText: 'Running deterministic validation (no LLM)...',
      explanation: isInfant
        ? `Ran 5 deterministic checks without any AI model: drug name present, infant age documented, FDA recall referenced, NASPGHAN PMID cited, letter length adequate. All passed. The appeal is ready for the PA Coordinator's review — a human is the final authority before anything is transmitted to the payer.`
        : `Ran 5 deterministic checks without AI: drug name present, diagnosis referenced, step therapy denial addressed, all 4 criteria cited, minimum letter length met. All passed. The appeal is ready for the PA Coordinator's final review and authorization before submission to ${scenario.plan}.`,
    },
  ]
}
