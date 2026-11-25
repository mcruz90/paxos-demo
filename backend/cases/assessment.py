"""Initial backend assessment of a case's trusted original source versions.

The caller supplies the current case snapshot and original canonical sources
from its trusted data plane. Attachments, user overrides and gold labels are
not assessment inputs. No artifact, adjudication or case mutation occurs.
"""

import json
from collections.abc import Iterable
from dataclasses import replace
from datetime import date
from hashlib import sha256

from agents.requirements_lookup import AutoProcessRule, resolve_pack
from cases.assessment_records import MAX_AGE_YEARS, Assessment, Finding
from cases.dose_fixture import DoseDocuments
from cases.dose_review import dose_review
from cases.duration_approval import DurationDecision, duration_approval
from cases.pediatric_findings import (
    DRUGS,
    LABELS,
    Observation,
    finding,
    observations,
    patient_values,
)
from models.case_evidence import CaseRecord, SourceVersion

# Pin the rule implementation to the exact T-10 requirements it interprets.
_PEDIATRIC_POLICY = "fc82ba6a2a5cb7a8827c78347adf3e23bebfe8d8175800dcc4028067dbe23236"


def _rule_digest(rule: AutoProcessRule) -> str:
    content = json.dumps(rule.model_dump(), sort_keys=True, separators=(",", ":"))
    return sha256(content.encode()).hexdigest()


_RULE_DIGEST = "7d4f60aedf9a3c1955cf3963ea9b09d47d37e3a7f172ce1892661f502f872f57"


def _pathway(rows: dict[str, Finding]) -> str | None:
    if all(rows[drug].status == "met" for drug in DRUGS):
        return "step_therapy"
    return next((key for key in ("swallowing", "feeding_tube") if rows[key].status == "met"), None)


def _verified_age(
    items: list[Observation], dob: date | None, service_date: date | None
) -> tuple[Finding, int | None]:
    evidence = tuple(item.citation for item in items)
    label = LABELS["age"]
    if dob is None or service_date is None:
        return Finding(
            "age",
            label,
            "missing",
            "Trusted dates are incomplete.",
            "Confirm the date of birth and the claim date of service.",
            evidence,
        ), None
    years = (
        service_date.year
        - dob.year
        - ((service_date.month, service_date.day) < (dob.month, dob.day))
    )
    valid_age = 0 <= years <= MAX_AGE_YEARS
    if not valid_age or patient_values(items) - {str(years)}:
        return Finding(
            "age",
            label,
            "conflict",
            "The age inputs disagree.",
            "Reconcile the chart age and the trusted claim and birth dates.",
            evidence,
        ), (years if valid_age else None)
    return Finding(
        "age", label, "met", "Calculated on the claim date of service.", None, evidence
    ), years


def _pediatric(
    case: CaseRecord,
    text: str,
    facts: dict[str, list[Observation]],
    dob: date | None,
    service_date: date | None,
    threshold: int,
) -> Assessment:
    keys = [key for key in LABELS if key not in ("attestation", "source_review")]
    for optional in ("attestation", "source_review"):
        if patient_values(facts.get(optional, [])):
            keys.append(optional)
    rows = {key: finding(key, facts.get(key, [])) for key in keys}
    rows["age"], years = _verified_age(facts.get("age", []), dob, service_date)
    if rows["age"].status == "met" and years is not None and years < threshold:
        return Assessment(
            case,
            text,
            _PEDIATRIC_POLICY,
            (rows["age"],),
            False,
            "no_pa_required",
            (),
            "Ask the payer to reprocess the claim under the pediatric auto-process rule.",
            years,
        )
    return _appeal(case, text, rows, years)


def _appeal(case: CaseRecord, text: str, rows: dict[str, Finding], years: int | None) -> Assessment:
    blocked = [
        key
        for key, row in rows.items()
        if row.status == "conflict"
        or (key in ("age", "diagnosis", "attestation", "source_review") and row.status != "met")
    ]
    pathway = _pathway(rows)
    if not pathway:
        blocked.extend(
            key for key in (*DRUGS, "swallowing", "feeding_tube") if rows[key].status == "missing"
        )
    ready = not blocked and pathway is not None
    action = rows[blocked[0]].next_action if blocked else None
    return Assessment(
        case,
        text,
        _PEDIATRIC_POLICY,
        tuple(rows.values()),
        ready,
        None if blocked else pathway,
        tuple(blocked),
        action,
        years,
    )


def _policy_hold(
    case: CaseRecord,
    blocker: str,
    action: str,
    documents: DoseDocuments | None,
    text: str | None = None,
    digest: str | None = None,
) -> Assessment:
    return Assessment(
        case,
        text,
        digest,
        (),
        False,
        None,
        (blocker,),
        action,
        dose_review=dose_review(documents, False),
    )


def assess_case(
    case: CaseRecord,
    sources: Iterable[SourceVersion],
    *,
    plan_id: str,
    drug: str,
    diagnosis: str,
    as_of: date | None,
    dob: date | None = None,
    service_date: date | None = None,
    duration_decision: DurationDecision | None = None,
    dose_documents: DoseDocuments | None = None,
) -> Assessment:
    """Derive findings for the pinned pediatric appeal. Other valid packs require review."""
    facts = observations(case, sources)
    pack, _ = resolve_pack(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    if isinstance(pack, str):
        return _policy_hold(case, "policy", pack, dose_documents)
    text = pack.criteria_text
    digest = sha256(text.encode()).hexdigest()
    if (
        digest != _PEDIATRIC_POLICY
        or pack.auto_process is None
        or _rule_digest(pack.auto_process) != _RULE_DIGEST
    ):
        return _policy_hold(
            case,
            "policy_review",
            "Review the matched payer requirements with the case records.",
            dose_documents,
            text,
            digest,
        )
    result = _pediatric(case, text, facts, dob, service_date, pack.auto_process.under_years)
    result = replace(result, dose_review=dose_review(dose_documents, True))
    if duration_decision and result.ready:
        approval = duration_approval(duration_decision)
        if approval:
            return replace(result, duration_approval=approval, next_action=approval.appeal_action())
    return result
