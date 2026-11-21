"""Initial backend assessment of a case's trusted original source versions.

The caller supplies the current case snapshot and original canonical sources
from its trusted data plane. Attachments, user overrides and gold labels are
not assessment inputs. No artifact, adjudication or case mutation occurs.
"""

from collections.abc import Iterable
from datetime import date
from hashlib import sha256

from agents.requirements_lookup import resolve_requirements
from cases.assessment_records import Assessment, Finding
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


def _pathway(rows: dict[str, Finding], ages: set[str]) -> str | None:
    if len(ages) == 1 and int(next(iter(ages))) < 6:
        return "no_pa_required"
    if all(rows[drug].status == "met" for drug in DRUGS):
        return "step_therapy"
    return next((key for key in ("swallowing", "feeding_tube") if rows[key].status == "met"), None)


def _pediatric(case: CaseRecord, text: str, facts: dict[str, list[Observation]]) -> Assessment:
    keys = [key for key in LABELS if key not in ("attestation", "source_review")]
    for optional in ("attestation", "source_review"):
        if patient_values(facts.get(optional, [])):
            keys.append(optional)
    rows = {key: finding(key, facts.get(key, [])) for key in keys}
    blocked = [
        key
        for key, row in rows.items()
        if row.status == "conflict"
        or (key in ("age", "diagnosis", "attestation", "source_review") and row.status != "met")
    ]
    pathway = _pathway(rows, patient_values(facts.get("age", [])))
    if not pathway:
        blocked.extend(
            key for key in (*DRUGS, "swallowing", "feeding_tube") if rows[key].status == "missing"
        )
    ready = not blocked and pathway not in (None, "no_pa_required")
    action = rows[blocked[0]].next_action if blocked else None
    if pathway == "no_pa_required" and not blocked:
        action = "Verify automatic claim processing under the applicable pediatric policy."
    return Assessment(
        case,
        text,
        _PEDIATRIC_POLICY,
        tuple(rows.values()),
        ready,
        None if blocked else pathway,
        tuple(blocked),
        action,
    )


def assess_case(
    case: CaseRecord,
    sources: Iterable[SourceVersion],
    *,
    plan_id: str,
    drug: str,
    diagnosis: str,
    as_of: date | None,
) -> Assessment:
    """Derive findings for the pinned pediatric appeal. Other valid packs require review."""
    facts = observations(case, sources)
    text, resolution = resolve_requirements(plan_id, drug, diagnosis=diagnosis, as_of=as_of)
    if resolution != "plan_id":
        return Assessment(case, None, None, (), False, None, ("policy",), text)
    digest = sha256(text.encode()).hexdigest()
    if digest != _PEDIATRIC_POLICY:
        return Assessment(
            case,
            text,
            digest,
            (),
            False,
            None,
            ("policy_review",),
            "Review the matched payer requirements with the case records.",
        )
    return _pediatric(case, text, facts)
