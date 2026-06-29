"""Seed + profile → structured synthetic documents.

generate_documents() is the single public entry point.
It is deterministic: same inputs → same outputs, no random state, no LLM calls.
"""

from __future__ import annotations

from dataclasses import dataclass

from golden_set.identities import IDENTITY_POOL, PatientIdentity
from golden_set.markers import SYNTHETIC_BANNER
from golden_set.seeds import AnchorSeed, CriterionSpec, ScenarioProfile
from golden_set.templates import (
    DENIAL_LETTER,
    RX_SNIPPET,
    SNIPPET_CONFLICT,
    SNIPPET_MET,
    SNIPPET_NEEDS_REVIEW,
    criteria_denial_line,
    render_criteria_section,
)
from models.schemas import PatientContext

# Fixed synthetic date used throughout the golden corpus.
# Changing this date bumps determinism tests — update seed/profile docs if you do.
_SYNTHESIS_DATE = "2024-03-14"


@dataclass
class GeneratedDocuments:
    denial_letter_text: str
    clinical_snippets: list[str]
    rx_snippet: str
    patient_context: PatientContext


def _identity_to_context(ident: PatientIdentity) -> PatientContext:
    return PatientContext(
        patient_name=ident.patient_name,
        patient_dob=ident.patient_dob,
        patient_sex=ident.patient_sex,
        member_id=ident.member_id,
        group_id=ident.group_id,
        patient_address=ident.patient_address,
        prescriber_name=ident.prescriber_name,
        prescriber_npi=ident.prescriber_npi,
        prescriber_specialty=ident.prescriber_specialty,
        prescriber_address=ident.prescriber_address,
        prescriber_phone=ident.prescriber_phone,
    )


def _render_denial_letter(
    seed: AnchorSeed,
    profile: ScenarioProfile,
    ident: PatientIdentity,
    date: str,
) -> str:
    criteria_lines = []
    for crit in profile.criteria:
        if crit.status == "needs_review":
            criteria_lines.append(
                criteria_denial_line(
                    crit.label,
                    "Documentation insufficient or not provided.",
                )
            )
        elif crit.status == "conflict":
            criteria_lines.append(
                criteria_denial_line(
                    crit.label,
                    "Conflicting documentation found between submitted records.",
                )
            )

    return DENIAL_LETTER.format_map(
        {
            "banner": SYNTHETIC_BANNER,
            "payer": seed.payer,
            "date": date,
            "patient_name": ident.patient_name,
            "patient_dob": ident.patient_dob,
            "patient_sex": ident.patient_sex,
            "member_id": ident.member_id,
            "group_id": ident.group_id,
            "patient_address": ident.patient_address,
            "prescriber_name": ident.prescriber_name,
            "prescriber_npi": ident.prescriber_npi,
            "prescriber_specialty": ident.prescriber_specialty,
            "prescriber_address": ident.prescriber_address,
            "prescriber_phone": ident.prescriber_phone,
            "drug": seed.drug,
            "diagnosis": seed.diagnosis,
            "icd_code": seed.icd_code,
            "plan_id": seed.plan_id,
            "denial_reason": seed.denial_reason,
            "criteria_section": render_criteria_section(criteria_lines),
        }
    )


def _render_snippet(crit: CriterionSpec, ident: PatientIdentity, date: str) -> str:
    common = {
        "banner": SYNTHETIC_BANNER,
        "date": date,
        "prescriber_name": ident.prescriber_name,
        "prescriber_specialty": ident.prescriber_specialty,
        "patient_name": ident.patient_name,
        "patient_dob": ident.patient_dob,
        "member_id": ident.member_id,
        "label": crit.label,
    }
    if crit.status == "met":
        return SNIPPET_MET.format_map({**common, "evidence": crit.evidence})
    if crit.status == "needs_review":
        return SNIPPET_NEEDS_REVIEW.format_map({**common, "review_note": crit.review_note})
    # conflict
    return SNIPPET_CONFLICT.format_map(
        {
            **common,
            "conflict_claim_1": crit.conflict_claim_1,
            "conflict_claim_2": crit.conflict_claim_2,
        }
    )


def _render_rx_snippet(seed: AnchorSeed, ident: PatientIdentity, date: str) -> str:
    return RX_SNIPPET.format_map(
        {
            "banner": SYNTHETIC_BANNER,
            "date": date,
            "payer": seed.payer,
            "patient_name": ident.patient_name,
            "member_id": ident.member_id,
            "prescriber_name": ident.prescriber_name,
            "prescriber_npi": ident.prescriber_npi,
            "drug": seed.drug,
            "diagnosis": seed.diagnosis,
            "icd_code": seed.icd_code,
            "plan_id": seed.plan_id,
        }
    )


def generate_documents(
    seed: AnchorSeed,
    profile: ScenarioProfile,
    *,
    date: str = _SYNTHESIS_DATE,
) -> GeneratedDocuments:
    """Generate synthetic denial letter, clinical snippets, and Rx snippet.

    Deterministic: same *seed* + *profile* + *date* always produce byte-identical output.
    No random state. No LLM calls on the default path.
    """
    ident = IDENTITY_POOL[seed.identity_index]
    patient_context = _identity_to_context(ident)
    denial_letter = _render_denial_letter(seed, profile, ident, date)
    clinical_snippets = [_render_snippet(c, ident, date) for c in profile.criteria]
    rx_snippet = _render_rx_snippet(seed, ident, date)
    return GeneratedDocuments(
        denial_letter_text=denial_letter,
        clinical_snippets=clinical_snippets,
        rx_snippet=rx_snippet,
        patient_context=patient_context,
    )
