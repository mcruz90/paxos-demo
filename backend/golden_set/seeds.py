"""Anchor seeds and scenario profiles for the three golden-set anchors.

AnchorSeed: the drug × plan × payer identity for one denial scenario.
CriterionSpec: one PA criterion with its status (met / needs_review / conflict)
               and the anchor-specific evidence text or conflict claims.
ScenarioProfile: the ordered set of criteria for one anchor.

SEEDS and PROFILES are keyed by anchor_id.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class AnchorSeed:
    anchor_id: str
    drug: str           # Drug name — must be [A-Za-z\s\(\)]* (no digits) for ETL regex
    payer: str
    plan_id: str
    diagnosis: str      # Human-readable, no digits (ETL _DIAGNOSIS_RE limitation)
    denial_reason: str  # No periods (ETL _DENIAL_REASON_RE stops at ".")
    icd_code: str       # ICD-10 alphanumeric, e.g. "E11.9"
    # Identity is resolved by anchor_id from golden/identities.json — no fragile index.


@dataclass(frozen=True)
class CriterionSpec:
    key: str
    label: str
    rule_type: str      # "diagnostic" | "temporal" | "math" | "safety" | "provider" | "custom"
    status: str         # "met" | "needs_review" | "conflict"
    # For "met" criteria — what evidence was documented
    evidence: str = field(default="")
    # For "needs_review" criteria — what is missing or incomplete
    review_note: str = field(default="")
    # For "conflict" criteria — the two contradictory source claims
    conflict_claim_1: str = field(default="")
    conflict_claim_2: str = field(default="")


@dataclass(frozen=True)
class ScenarioProfile:
    anchor_id: str
    criteria: tuple[CriterionSpec, ...]


# ---------------------------------------------------------------------------
# Anchor seeds
# ---------------------------------------------------------------------------

SEEDS: dict[str, AnchorSeed] = {
    "ozempic_cigna": AnchorSeed(
        anchor_id="ozempic_cigna",
        drug="Ozempic (semaglutide)",
        payer="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF360-2024",
        diagnosis="Type II Diabetes Mellitus",
        # No period inside — ETL regex captures until the trailing "."
        denial_reason=(
            "indication not confirmed as limited to glycemic management in Type II Diabetes; "
            "concurrent obesity documentation may indicate weight-loss use outside policy scope"
        ),
        icd_code="E11.9",
    ),
    "esomeprazole_uhc_pediatric": AnchorSeed(
        anchor_id="esomeprazole_uhc_pediatric",
        drug="Nexium for Oral Suspension (esomeprazole)",
        payer="UnitedHealthcare Choice Plus",
        plan_id="UHC-CHOICE-2024",
        diagnosis="Pediatric Gastroesophageal Reflux Disease with oral-motor dysphagia",
        denial_reason=(
            "step therapy requirements not met; "
            "swallowing limitation documentation conflicts with clinical chart notes"
        ),
        icd_code="K21.0",
    ),
    "livdelzi_cigna_hepatology": AnchorSeed(
        anchor_id="livdelzi_cigna_hepatology",
        drug="Livdelzi (seladelpar)",
        payer="Cigna Connect 500 PPO",
        plan_id="CIGNA-CNF877-2024",
        diagnosis="Primary Biliary Cholangitis",
        denial_reason=(
            "inadequate documentation of UDCA trial duration; "
            "prescriber attestation of at least twelve continuous months required"
        ),
        icd_code="K83.01",
    ),
}

# ---------------------------------------------------------------------------
# Scenario profiles — per-criterion evidence grounded in the real policies
# ---------------------------------------------------------------------------

PROFILES: dict[str, ScenarioProfile] = {
    "ozempic_cigna": ScenarioProfile(
        anchor_id="ozempic_cigna",
        criteria=(
            CriterionSpec(
                key="t2dm_diagnosis",
                label="Type II Diabetes Mellitus confirmed",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "HbA1c 8.2% on 03/14/2024 (ref range < 5.7%). "
                    "ICD-10 E11.9 documented in chart since 2019. "
                    "Fasting glucose 187 mg/dL confirming active T2DM."
                ),
            ),
            CriterionSpec(
                key="adult_age_threshold",
                label="Patient age meets minimum threshold (18 years)",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "Patient DOB 03/14/1972; age 52 at time of request. "
                    "Cigna GLP-1 policy minimum age 18 years met."
                ),
            ),
            CriterionSpec(
                key="no_concomitant_glp1",
                label="No concurrent GLP-1 or GLP-1/GIP agonist on active medication list",
                rule_type="safety",
                status="met",
                evidence=(
                    "Current medication list reviewed 03/14/2024: metformin 1000 mg BID, "
                    "lisinopril 10 mg, atorvastatin 40 mg. "
                    "No other GLP-1 or GLP-1/GIP agonist (Wegovy, Trulicity, Mounjaro, "
                    "Saxenda, Zepbound) on active list."
                ),
            ),
            CriterionSpec(
                key="indication_t2dm_only",
                label="Indication limited to glycemic management in Type II Diabetes",
                rule_type="custom",
                status="needs_review",
                review_note=(
                    "Chart includes BMI 33.2 kg/m2 and a notation 'weight management goals "
                    "discussed' from 01/10/2024 visit. Payer requests clarification that "
                    "Ozempic is prescribed solely for T2DM glycemic control and not for "
                    "obesity/weight-loss management, which falls under a separate policy."
                ),
            ),
        ),
    ),
    "esomeprazole_uhc_pediatric": ScenarioProfile(
        anchor_id="esomeprazole_uhc_pediatric",
        criteria=(
            CriterionSpec(
                key="gerd_diagnosis",
                label="GERD or erosive esophagitis diagnosis documented",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "Upper GI endoscopy 11/15/2023: mild esophagitis (Los Angeles Grade A). "
                    "ICD-10 K21.0 confirmed. pH impedance study pending."
                ),
            ),
            CriterionSpec(
                key="age_6_or_older",
                label="Patient age 6 or older (auto-process exemption does not apply)",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "Patient DOB 09/22/2017; age 7 at time of request (02/2025). "
                    "UHC auto-process rule (no PA required under age 6) does NOT apply; "
                    "step therapy criteria are applicable."
                ),
            ),
            CriterionSpec(
                key="ppi_step_therapy",
                label="Documented failure of omeprazole, pantoprazole, and rabeprazole",
                rule_type="temporal",
                status="needs_review",
                review_note=(
                    "Chart documents omeprazole 10 mg daily x 8 weeks (failed — reflux "
                    "symptoms persisted). Pantoprazole not documented. Rabeprazole not "
                    "documented. UHC step therapy requires failure of all three agents; "
                    "two of three agents are missing from the prior-treatment history."
                ),
            ),
            CriterionSpec(
                key="swallowing_limitation",
                label="Documented oral-motor dysphagia or swallowing limitation",
                rule_type="custom",
                status="conflict",
                conflict_claim_1=(
                    "Speech-language pathology report 12/02/2023: oral-motor dysphagia "
                    "confirmed; patient unable to safely swallow tablets or capsules."
                ),
                conflict_claim_2=(
                    "Office visit note 01/15/2024 (Dr. Ekwueme): 'Patient tolerating "
                    "crushed omeprazole tablet mixed with food without difficulty.'"
                ),
            ),
        ),
    ),
    "livdelzi_cigna_hepatology": ScenarioProfile(
        anchor_id="livdelzi_cigna_hepatology",
        criteria=(
            CriterionSpec(
                key="pbc_diagnosis",
                label="Primary Biliary Cholangitis confirmed (ALP elevated, AMA positive)",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "ALP 198 U/L (ref < 115 U/L) on 02/20/2024. "
                    "AMA positive (titer 1:640) on 01/08/2024. "
                    "Meets AASLD 2021 diagnostic criteria: 2 of 3 criteria present "
                    "(elevated ALP above ULN + positive AMA); liver biopsy not required."
                ),
            ),
            CriterionSpec(
                key="adult_age_18",
                label="Patient age 18 or older",
                rule_type="diagnostic",
                status="met",
                evidence=(
                    "Patient DOB 11/07/1970; age 54 at time of request. "
                    "Cigna Livdelzi policy requires patient be at least 18 years old."
                ),
            ),
            CriterionSpec(
                key="no_decompensation",
                label="No current or prior hepatic decompensation",
                rule_type="safety",
                status="met",
                evidence=(
                    "Hepatology notes reviewed through 03/2024: no history of ascites, "
                    "variceal bleeding, or hepatic encephalopathy. MELD score 9. "
                    "Liver function compensated per Dr. Okonkwo attestation 02/20/2024."
                ),
            ),
            CriterionSpec(
                key="specialist_prescriber",
                label="Gastroenterologist or hepatologist prescriber",
                rule_type="provider",
                status="met",
                evidence=(
                    "Prescriber: Dr. Samuel Okonkwo, MD — Hepatology. "
                    "NPI 3456789012 on file. Board-certified hepatologist; "
                    "meets Cigna specialist prescriber requirement."
                ),
            ),
            CriterionSpec(
                key="udca_trial_duration",
                label="UDCA therapy for 12 or more months with inadequate response",
                rule_type="temporal",
                status="needs_review",
                review_note=(
                    "Ursodiol 300 mg TID initiated 06/15/2023 per pharmacy records. "
                    "Duration at time of PA request (02/20/2024): approximately 8 months. "
                    "Cigna policy requires at least 12 continuous months before Livdelzi "
                    "is considered. ALP remains elevated (198 U/L) but duration requirement "
                    "is not yet met."
                ),
            ),
        ),
    ),
}
