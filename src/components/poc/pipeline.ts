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
        explanation: `Resolved the ${scenario.plan} GLP-1 policy pack from the registry (BIN/PCN/Group). Ran the Da Vinci DTR (Documentation Templates & Rules) step: pulled the payer's PA questionnaire and auto-answered each item from the patient chart — confirmed T2DM (E11.9), patient age ≥18, no concomitant GLP-1 agent on active list, and prescriber attestation of T2DM-only indication. Every answer is bound to a source document.`,
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
  const isEsoSuspension = scenario.id === 'pediatric-esomeprazole'
  return [
    {
      label: 'Ingestion',
      loadingText: isEsoSuspension
        ? 'Parsing UHC denial for esomeprazole (Nexium) suspension...'
        : `Parsing ${scenario.plan} denial for ${scenario.drug}...`,
      explanation: isEsoSuspension
        ? `Parsed the UnitedHealthcare denial for Nexium (esomeprazole) for suspension. Identified the denial as a step-therapy requirement under UHC's Proton Pump Inhibitor program — the payer requires documented trial or intolerance of tablet PPIs (omeprazole, pantoprazole, rabeprazole) before covering a suspension. Extracted patient age (7 years), diagnosis (erosive GERD, K21.0), and the swallowing-limitation exception the policy allows.`
        : `Parsed the ${scenario.plan} denial for ${scenario.drug} (semaglutide). Identified the denial as a custom indication review: the payer asserts the chart documentation — BMI 33.2 and a weight management note — may indicate weight-loss use, which falls under a separate policy (Wegovy/Zepbound). Extracted drug, diagnosis (T2DM, E11.9), and the four cnf_360 PA criteria to satisfy.`,
    },
    {
      label: 'Retrieval',
      loadingText: isEsoSuspension
        ? 'Loading UHC PPI step-therapy policy + speech-pathology records...'
        : `Loading ${scenario.plan} PA policy for GLP-1 agonists...`,
      explanation: isEsoSuspension
        ? `Loaded UHC's Proton Pump Inhibitor step-therapy criteria. The policy approves Nexium suspension on a documented swallowing limitation — oral/motor difficulty or dysphagia — as an explicit alternative to the three-drug tablet step therapy. Retrieved the patient's speech-language pathology evaluation documenting oral-motor dysphagia with aspiration risk, establishing the bypass the payer's denial overlooked.`
        : `Loaded Cigna's GLP-1 agonist policy cnf_360. Retrieved 4 criteria: confirmed T2DM diagnosis (E11.9), patient age ≥18, no concomitant GLP-1 or GLP-1/GIP agonist on active list, and indication confirmed as T2DM glycemic control. Policy states no HbA1c threshold and no metformin step therapy — the denial does not rest on those grounds. Retrieved prescriber chart notes documenting the clinical rationale as T2DM management.`,
    },
    {
      label: 'Synthesis',
      loadingText: 'Drafting evidence-grounded appeal letter...',
      explanation: isEsoSuspension
        ? `Generated an appeal grounded in the policy's own step-therapy exception: (1) a speech-language pathology evaluation documents oral-motor dysphagia — the patient cannot safely swallow tablet or capsule PPIs, which UHC accepts as a step-therapy bypass; (2) endoscopy confirms LA Grade B erosive esophagitis (K21.0) requiring adequate acid suppression. Cited NASPGHAN/ESPGHAN 2018 pediatric GERD guidelines (PMID 29470322) for the dosing standard.`
        : `Generated an appeal grounded in all 4 cnf_360 criteria. T2DM confirmed via endocrinology consult (E11.9, established 2021). Patient age 52 meets the ≥18 threshold. No concomitant GLP-1/GIP agonist on active medication list. Addressed the indication question directly: prescriber attestation and chart documentation confirm Ozempic is prescribed for T2DM glycemic control; BMI documentation does not displace the T2DM indication. Every claim traces to a source document; no unsupported assertions.`,
    },
    {
      label: 'Gatekeeper',
      loadingText: 'Running deterministic validation (no LLM)...',
      explanation: isEsoSuspension
        ? `Ran 5 deterministic checks without any AI model: drug name present, dysphagia documentation referenced, step-therapy denial addressed, NASPGHAN PMID cited, letter length adequate. All passed. The appeal is ready for the PA Coordinator's review — a human is the final authority before anything is transmitted to the payer.`
        : `Ran 5 deterministic checks without AI: drug name present, diagnosis referenced, indication clarification addressed, prescriber attestation cited, minimum letter length met. All passed. The appeal is ready for the PA Coordinator's final review and authorization before submission to ${scenario.plan}.`,
    },
  ]
}
