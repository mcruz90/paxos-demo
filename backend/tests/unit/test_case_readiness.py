"""Independent synthetic case records for the initial pediatric appeal assessment."""

from datetime import date
from hashlib import sha256

import pytest

from models.case_evidence import CaseRecord, SourceVersion

CASE = CaseRecord(case_id="case1", tenant_id="tenant", patient_ref="PT-1", revision=1)
AGE = "Age at request: 9 years.\nDiagnosis: K21.0."
SWALLOW = "Unable to swallow whole tablets or capsules due to dysphagia."
CRUSHED = "Tolerates crushed medication."
TUBE = "Medications administered via feeding tube."
PENDING = "Prescriber attestation requested: swallowing limitation."
SIGNED = (
    "Signed prescriber attestation: unable to swallow whole tablets or capsules due to dysphagia."
)


def source(body, key="chart", category="patient_record"):
    return SourceVersion(
        source_version_id=key,
        case_id=CASE.case_id,
        tenant_id=CASE.tenant_id,
        category=category,
        patient_ref=CASE.patient_ref if category == "patient_record" else None,
        body=body,
        body_sha256=sha256(body.encode()).hexdigest(),
        origin_ref=key,
    )


def assess(*documents, **overrides):
    from cases.assessment import assess_case

    request = dict(
        plan_id="UHC-CHOICE-2024",
        drug="Nexium oral suspension",
        diagnosis="K21.0",
        as_of=date(2026, 8, 1),
    )
    return assess_case(CASE, documents, **(request | overrides))


def by_id(result):
    return {finding.criterion_id: finding for finding in result.findings}


def test_alternate_preserves_missing_trials_and_actions():
    result = assess(
        source("\n".join([AGE, SWALLOW, "Prescription omeprazole: intolerance: reported nausea."]))
    )
    assert result.ready and result.pathway == "swallowing"
    rows = by_id(result)
    assert rows["omeprazole"].status == "met"
    for drug in ["pantoprazole", "rabeprazole"]:
        assert rows[drug].status == "missing" and drug in rows[drug].next_action.lower()
    assert rows["swallowing"].evidence[0].excerpt == SWALLOW
    assert result.revision == CASE.revision


def test_context_links_but_never_proves_patient_fact():
    result = assess(source(AGE), source(SWALLOW, "guide", "guideline"))
    row = by_id(result)["swallowing"]
    assert not result.ready and row.status == "missing"
    assert [(e.role, e.source_version_id) for e in row.evidence] == [("context", "guide")]


def test_disputed_swallowing_blocks_even_with_other_path_and_signed_note():
    result = assess(
        source("\n".join([AGE, SWALLOW, TUBE])), source(CRUSHED, "other"), source(SIGNED, "signed")
    )
    row = by_id(result)["swallowing"]
    assert not result.ready and "swallowing" in result.blockers
    assert row.status == "conflict" and row.next_action
    assert {e.source_version_id for e in row.evidence} == {"chart", "other", "signed"}


def test_requested_attestation_blocks_alternate_until_documented():
    documents = [source("\n".join([AGE, TUBE, PENDING]))]
    result = assess(*documents)
    assert not result.ready and "attestation" in result.blockers
    assert by_id(result)["attestation"].next_action
    assert not assess(*documents, source(SIGNED, "article", "research")).ready
    assert assess(*documents, source(SIGNED, "signed")).ready


def test_step_path_requires_documented_outcome_for_every_agent():
    chart = "\n".join(
        [
            AGE,
            "Prescription omeprazole: failure: symptoms persisted.",
            "Pantoprazole: intolerance: reported nausea.",
        ]
    )
    assert not assess(source(chart + "\nRabeprazole: prescribed.")).ready
    assert (
        assess(source(chart + "\nRabeprazole: contraindication: documented allergy.")).pathway
        == "step_therapy"
    )


def test_age_and_under_six_auto_process():
    assert not assess(source(TUBE)).ready
    result = assess(source("Age at request: 5 years.\nDiagnosis: K21.0."))
    assert result.ready is False and result.pathway == "no_pa_required"
    assert not assess(source(AGE + "\nAge at request: 5 years.\n" + TUBE)).ready


@pytest.mark.parametrize("override", [{"drug": "unrelated"}, {"as_of": None}])
def test_policy_hold_has_action_and_no_criteria(override):
    result = assess(source(AGE + "\n" + TUBE), **override)
    assert not result.ready and result.next_action and not result.findings
    assert result.policy_text is None


@pytest.mark.parametrize(
    "updates",
    [
        {"case_id": "other"},
        {"tenant_id": "other"},
        {"patient_ref": "PT-2"},
        {"body_sha256": "0" * 64},
    ],
)
def test_rejects_invalid_source(updates):
    with pytest.raises(ValueError):
        assess(source(TUBE).model_copy(update=updates))


def test_rejects_ambiguous_source_identity():
    with pytest.raises(ValueError):
        assess(source(AGE), source(TUBE))


def test_request_indication_is_not_a_chart_finding():
    result = assess(source("Age at request: 9 years.\n" + TUBE))
    assert not result.ready and "diagnosis" in result.blockers
    row = by_id(result)["diagnosis"]
    assert not row.evidence and row.next_action


def test_unknown_chart_text_requires_review_even_with_a_supported_pathway():
    result = assess(source(AGE + "\n" + TUBE + "\nUpdated chart needs interpretation."))
    assert not result.ready and "source_review" in result.blockers


def test_other_matched_policy_requires_review():
    result = assess(source(AGE), plan_id="CIGNA-CNF360-2024", drug="Ozempic", diagnosis="E11.9")
    assert result.policy_text and result.policy_sha256 and not result.ready
    assert result.blockers == ("policy_review",) and result.next_action


@pytest.mark.parametrize(
    ("agent", "outcome"),
    [
        ("Prescription omeprazole", "contraindication"),
        ("Pantoprazole", "failure"),
        ("Rabeprazole", "intolerance"),
    ],
)
def test_bare_outcome_requires_agent_specific_reason(agent, outcome):
    drug = agent.lower().removeprefix("prescription ")
    result = assess(
        source(f"{AGE}\n{agent}: {outcome}."),
        source(f"{agent}: {outcome}: reason from context.", "guide", "guideline"),
    )
    row = by_id(result)[drug]
    assert row.status == "missing"
    assert row.next_action == f"Document the reason for {drug} {outcome}."
    assert "source_review" not in result.blockers


@pytest.mark.parametrize("reason", ["X", "ß" * 300])
def test_reason_is_cited_verbatim_and_bounded_in_source_characters(reason):
    line = f"Pantoprazole: failure: {reason}."
    body = f"{AGE}\n{line}"
    rows = by_id(assess(source(body)))
    row = rows["pantoprazole"]
    assert row.status == "met" and "source_review" not in rows
    (cite,) = row.evidence
    assert body[cite.start : cite.end] == cite.excerpt == line


@pytest.mark.parametrize("reason", [" " * 3, "X" * 301])
def test_unusable_reason_cannot_satisfy_trial(reason):
    result = assess(source(f"{AGE}\nPantoprazole: failure: {reason}."))
    assert by_id(result)["pantoprazole"].status == "missing"


def test_feeding_tube_conflict_blocks_an_otherwise_ready_case():
    chart = source("\n".join([AGE, SWALLOW, TUBE]))
    assert assess(chart).ready
    result = assess(chart, source("Medications not administered via feeding tube.", "other"))
    row = by_id(result)["feeding_tube"]
    assert not result.ready and result.blockers == ("feeding_tube",)
    assert row.status == "conflict" and row.next_action
    assert {cite.source_version_id for cite in row.evidence} == {"chart", "other"}


@pytest.mark.parametrize(
    "sep", ["\n", "\r\n", "\r", "\v", "\f", "\x1c", "\x1d", "\x1e", "\x85", "\u2028", "\u2029"]
)
def test_citation_excludes_separator_and_preserves_source_offsets(sep):
    first = "Chart annotation 📝."
    body = sep.join([first, TUBE, ""])
    rows = by_id(assess(source(body)))
    for key, line, start in [("source_review", first, 0), ("feeding_tube", TUBE, len(first + sep))]:
        (cite,) = rows[key].evidence
        assert (cite.start, cite.end) == (start, start + len(line))
        assert body[cite.start : cite.end] == cite.excerpt == line
