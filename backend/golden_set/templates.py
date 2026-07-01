"""Deterministic string templates for synthetic document generation.

All templates use str.format_map() substitution — no LLM, no random values.
Variables enclosed in {braces} are substituted by documents.py.

Responsibility: format strings only. Content (evidence text, conflict claims)
lives in seeds.py. Identity values come from identities.py.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Denial letter
# ---------------------------------------------------------------------------

# The structure is designed so process_denial_letter() can extract all key fields:
#   _DRUG_RE      matches "Authorization for {drug} has been denied"
#   _DENIAL_REASON_RE  matches "Denied: {denial_reason}."
#   _PLAN_ID_RE   matches "Plan ID: {plan_id}"
#   _DIAGNOSIS_RE matches "Diagnosis: {diagnosis}."
DENIAL_LETTER = """\
{banner}

{payer}
PRIOR AUTHORIZATION DETERMINATION
Date: {date}

MEMBER INFORMATION
Patient Name: {patient_name}
Date of Birth: {patient_dob}
Sex: {patient_sex}
Member ID: {member_id}
Group ID: {group_id}
Address: {patient_address}

REQUESTING PROVIDER
Provider: {prescriber_name}
NPI: {prescriber_npi}
Specialty: {prescriber_specialty}
Address: {prescriber_address}
Phone: {prescriber_phone}

RE: PRIOR AUTHORIZATION DENIAL
Drug: {drug}
Diagnosis: {diagnosis}.
ICD-10 Code: {icd_code}
Plan: {payer} | Plan ID: {plan_id}

DETERMINATION: DENIED

Authorization for {drug} has been denied for the treatment of {diagnosis}.

Denied: {denial_reason}.

CLINICAL BASIS FOR DENIAL:
{criteria_section}
You have the right to appeal this determination within 180 days of this notice.
Contact Member Services at the number on the back of your insurance card.

{banner}"""

# ---------------------------------------------------------------------------
# Clinical snippet templates — one per criterion, per status
# ---------------------------------------------------------------------------

# "met" — criterion is satisfied in the clinical record
SNIPPET_MET = """\
{banner}

CLINICAL PROGRESS NOTE
Date: {date}
Provider: {prescriber_name} ({prescriber_specialty})
Patient: {patient_name} | DOB: {patient_dob} | Member ID: {member_id}

Criterion: {label}
Status: CONFIRMED
Finding: {evidence}

{banner}"""

# "needs_review" — criterion cannot be confirmed from current documentation
SNIPPET_NEEDS_REVIEW = """\
{banner}

CLINICAL PROGRESS NOTE — ADDITIONAL DOCUMENTATION NEEDED
Date: {date}
Provider: {prescriber_name} ({prescriber_specialty})
Patient: {patient_name} | DOB: {patient_dob} | Member ID: {member_id}

Criterion: {label}
Status: INCOMPLETE
Finding: {review_note}

{banner}"""

# "conflict" — two source documents assert contradictory claims
SNIPPET_CONFLICT = """\
{banner}

CLINICAL DOCUMENTATION CONFLICT REPORT
Date: {date}
Provider: {prescriber_name} ({prescriber_specialty})
Patient: {patient_name} | DOB: {patient_dob} | Member ID: {member_id}

Criterion: {label}
Status: CONFLICT DETECTED

Source 1: {conflict_claim_1}

Source 2: {conflict_claim_2}

Note: Prescriber attestation conflicts with chart documentation.
Resolution required before determination can be made.

{banner}"""

# ---------------------------------------------------------------------------
# Rx snippet
# ---------------------------------------------------------------------------

RX_SNIPPET = """\
{banner}

PHARMACY PRESCRIPTION RECORD
Date: {date}
Pharmacy: {payer} Specialty Pharmacy Network
Patient: {patient_name} | Member ID: {member_id}
Prescriber: {prescriber_name} | NPI: {prescriber_npi}

Drug: {drug}
Diagnosis: {diagnosis}
ICD-10: {icd_code}
Plan ID: {plan_id}

Prescription status: PENDING PRIOR AUTHORIZATION

{banner}"""

# ---------------------------------------------------------------------------
# Criteria section helpers (used to build the denial letter body)
# ---------------------------------------------------------------------------

_CRITERIA_UNMET_LINE = "- {label}: {note}\n"


def render_criteria_section(criteria_lines: list[str]) -> str:
    """Join per-criterion denial lines into the letter's 'CLINICAL BASIS' block."""
    if not criteria_lines:
        return "  No specific criteria deficiencies identified in this record.\n"
    return "".join(criteria_lines)


def criteria_denial_line(label: str, note: str) -> str:
    return _CRITERIA_UNMET_LINE.format(label=label, note=note)


# ---------------------------------------------------------------------------
# Minimal denial skeleton — for contexts without full patient/prescriber
# identity (e.g. evals.fixtures_adapter, which adapts EvalScenario labels
# that carry no PatientContext). Shares the DETERMINATION/Reason skeleton
# with DENIAL_LETTER above, minus the identity and banner fields.
# ---------------------------------------------------------------------------


def render_minimal_denial(payer: str, drug: str, reason: str, scenario_id: str) -> str:
    return (
        f"PRIOR AUTHORIZATION DETERMINATION\n"
        f"{payer}\n\n"
        f"DETERMINATION: DENIED\n\n"
        f"Authorization for {drug} has been denied.\n"
        f"Reason: {reason}\n\n"
        f"[Synthetic document — scenario {scenario_id}]"
    )
