"""Unit tests for PTC-01 deterministic EHR evidence distiller."""

from __future__ import annotations

from datetime import date
from hashlib import sha256
from typing import Literal

import pytest

from cases.assessment import assess_case
from cases.assessment_sources import AssessmentInputs
from cases.duration_approval import DurationDecision, duration_approval
from etl.ehr_extract import (
    ChartEvidenceDigest,
    digest_to_source_versions,
    distill_assessment_inputs,
    distill_chart,
)
from models.case_evidence import CaseRecord, SourceVersion

_CASE = CaseRecord(case_id="case-ptc01", tenant_id="tenant-1", patient_ref="PT-100", revision=1)
_Cat = Literal["patient_record", "payer_policy", "guideline", "research"]


def _make_source(
    source_version_id: str, body: str, *, category: _Cat = "patient_record"
) -> SourceVersion:
    return SourceVersion(
        source_version_id=source_version_id,
        case_id=_CASE.case_id,
        tenant_id=_CASE.tenant_id,
        category=category,
        patient_ref=_CASE.patient_ref if category == "patient_record" else None,
        body=body,
        body_sha256=sha256(body.encode()).hexdigest(),
        origin_ref=source_version_id,
    )


def test_fanout_over_20_notes_reduces_to_relevant_spans_and_exact_citations() -> None:
    noise = [
        _make_source(
            f"routine-{i:02d}",
            f"Encounter #{i} check-in completed at front desk.\nFollow-up scheduling confirmed.",
        )
        for i in range(1, 21)
    ]
    relevant = [
        _make_source(
            "note-dx",
            "Header: Hepatology Consult\nDiagnosis: Primary Biliary Cholangitis (K74.3) on 2024-02-20.",
        ),
        _make_source(
            "note-lab", "Lab summary — patient panel\nALP: 198 U/L (ULN 115 U/L) on 2024-02-20."
        ),
        _make_source(
            "note-trial",
            "Ursodiol 300 mg TID: 2023-06-15 to 2024-02-20; inadequate response: ALP remained elevated.",
        ),
        _make_source("note-spec", "Prescriber: Dr. Samuel Okonkwo, MD — Hepatology."),
    ]
    all_sources = [*noise, *relevant]
    bodies = {s.source_version_id: s.body for s in all_sources}
    digests = {s.source_version_id: s.body_sha256 for s in all_sources}

    digest = distill_chart(_CASE, all_sources)
    assert isinstance(digest, ChartEvidenceDigest)
    assert (digest.source_count, digest.retained_source_count) == (24, 4)
    assert (
        len(digest.diagnoses),
        len(digest.labs),
        len(digest.step_therapy),
        len(digest.specialists),
    ) == (1, 1, 1, 1)
    assert not digest.review_flags
    for cite in digest.all_citations():
        assert bodies[cite.source_version_id][cite.start : cite.end] == cite.excerpt
        assert digests[cite.source_version_id] == cite.source_sha256


def test_step_therapy_inclusive_days_and_invalid_or_ambiguous_dates() -> None:
    src = _make_source(
        "trials-1",
        "\n".join(
            [
                "Methotrexate 15 mg weekly: 2025-01-01 to 2025-04-15; failure: persistent synovitis.",
                "Step therapy: Pantoprazole 40 mg: 06/15/2023 to 02/20/2024; intolerance: nausea.",
                "Prescription omeprazole: failure: reflux persisted.",
                "Leflunomide 20 mg: 2025-05-01 to 2025-04-01; failure: reversed dates.",
                "Ursodiol started in 2023; stop date unclear.",
                "Omeprazole: 03/04/2026 to 05/04/2026; failure",
            ]
        ),
    )
    digest = distill_chart(_CASE, [src])
    assert len(digest.step_therapy) == 4
    mtx, panto, omep, ambig_trial = digest.step_therapy
    assert (mtx.drug, mtx.duration_days, mtx.outcome) == (
        "Methotrexate 15 mg weekly",
        105,
        "failure",
    )
    assert (mtx.start_date, mtx.end_date, mtx.reason) == (
        date(2025, 1, 1),
        date(2025, 4, 15),
        "persistent synovitis",
    )
    assert (panto.drug, panto.duration_days, panto.outcome) == (
        "Pantoprazole 40 mg",
        251,
        "intolerance",
    )
    assert (omep.drug, omep.duration_days, omep.outcome) == ("omeprazole", None, "failure")
    assert (ambig_trial.drug, ambig_trial.duration_days, ambig_trial.outcome) == (
        "Omeprazole",
        None,
        "failure",
    )

    reasons = {flag.reason for flag in digest.review_flags}
    assert {"invalid_date_range", "ambiguous_trial_dates", "ambiguous_date_format"} <= reasons
    for flag in digest.review_flags:
        assert src.body[flag.citation.start : flag.citation.end] == flag.citation.excerpt


def test_duration_days_matches_duration_approval_inclusive_rule() -> None:
    fill = date(2026, 10, 23)
    decision = DurationDecision(
        20,
        56,
        28,
        date(2026, 10, 28),
        "28 of 56 days",
        date(2026, 11, 3),
        date(2026, 11, 13),
        True,
        fill,
        "pharmacy",
    )
    approval = duration_approval(decision)
    assert approval is not None and approval.supply_end_date is not None
    src = _make_source(
        "dur-1",
        f"Esomeprazole: {fill.isoformat()} to {approval.supply_end_date.isoformat()}; completed.",
    )
    digest = distill_chart(_CASE, [src])
    assert len(digest.step_therapy) == 1
    assert digest.step_therapy[0].duration_days == decision.approved_days == 28


@pytest.mark.parametrize(
    ("line", "analyte", "val", "op", "thresh", "relation"),
    [
        ("ALP: 198 U/L (ULN 115 U/L) on 2024-02-20.", "ALP", 198.0, "ULN", 115.0, "above"),
        ("HbA1c: 8.2% (ref < 5.7%)", "HbA1c", 8.2, "<", 5.7, "above"),
        ("eGFR: 68 mL/min (threshold >= 60 mL/min)", "eGFR", 68.0, ">=", 60.0, "above"),
        ("ALT: 22 U/L (ULN 35 U/L)", "ALT", 22.0, "ULN", 35.0, "below"),
        ("Potassium: 4.0 mmol/L (threshold >= 4.0 mmol/L)", "Potassium", 4.0, ">=", 4.0, "at"),
        ("ALP: 198 U/L.", "ALP", 198.0, None, None, "unknown"),
    ],
)
def test_numeric_lab_threshold_parsing(
    line: str, analyte: str, val: float, op: str | None, thresh: float | None, relation: str
) -> None:
    src = _make_source("lab-1", line)
    digest = distill_chart(_CASE, [src])
    assert len(digest.labs) == 1
    lab = digest.labs[0]
    assert (
        lab.analyte,
        lab.value,
        lab.threshold_operator,
        lab.threshold_value,
        lab.threshold_relation,
    ) == (analyte, val, op, thresh, relation)
    assert src.body[lab.citation.start : lab.citation.end] == lab.citation.excerpt


def test_non_lab_measurements_not_matched_as_labs_and_unit_mismatch_flagged() -> None:
    src = _make_source("non-lab", "Requested dose: 20 mg\nWeight: 22 kg")
    assert not distill_chart(_CASE, [src]).labs
    mismatch = distill_chart(_CASE, [_make_source("lab-mismatch", "ALP: 198 U/L (ULN 2.0 mg/dL)")])
    assert not mismatch.labs and [f.reason for f in mismatch.review_flags] == [
        "ambiguous_threshold"
    ]


def test_specialist_markers_and_icd10_extraction_with_unicode_separators() -> None:
    body = (
        "\u2028".join(
            [
                "Signed by: Dr. Jane Doe, MD (Rheumatology) on 2026-04-10.",
                "Consultant: Dr. Alice Smith, Gastroenterology.",
                "ICD-10: E11.9 — Type 2 Diabetes Mellitus.",
            ]
        )
        + "\r\n"
    )
    src = _make_source("spec-dx", body)
    digest = distill_chart(_CASE, [src])
    assert (
        len(digest.specialists),
        digest.specialists[0].role_kind,
        digest.specialists[0].signed_date,
    ) == (2, "signer", date(2026, 4, 10))
    assert (digest.specialists[1].role_kind, digest.specialists[1].specialty) == (
        "consultant",
        "Gastroenterology",
    )
    assert len(digest.diagnoses) == 1 and digest.diagnoses[0].icd10_codes == ("E11.9",)
    for cite in digest.all_citations():
        assert body[cite.start : cite.end] == cite.excerpt


def test_unrecognized_and_ambiguous_clinical_lines_flagged_for_review() -> None:
    src = _make_source(
        "ambig",
        "\n".join(
            [
                "Front desk check-in completed.",
                "Tolerates crushed medication.",
                "ALP elevated; repeat labs pending.",
                "Updated chart needs interpretation.",
            ]
        ),
    )
    digest = distill_chart(_CASE, [src])
    assert digest.needs_human_review
    assert [f.citation.excerpt for f in digest.review_flags] == [
        "Tolerates crushed medication.",
        "ALP elevated; repeat labs pending.",
        "Updated chart needs interpretation.",
    ]
    assert (digest.review_flags[0].reason, digest.review_flags[1].reason) == (
        "ambiguous_clinical_statement",
        "unrecognized_clinical_statement",
    )


def test_bridge_preserves_full_sources_offsets_and_flags_all_unmatched_lines() -> None:
    unmatched_no_cue = "Allergic reaction to PPIs documented."
    src = _make_source(
        "gi-note", f"Age at request: 9 years.\nDiagnosis: K21.0.\n{unmatched_no_cue}"
    )
    slp = _make_source("slp-note", "Unable to swallow whole tablets or capsules due to dysphagia.")
    inputs = AssessmentInputs(
        (src, slp),
        "UHC-CHOICE-2026",
        "Nexium oral suspension",
        "K21.0",
        date(2017, 8, 1),
        date(2026, 8, 1),
        date(2026, 8, 1),
    )

    kept_inputs, digest = distill_assessment_inputs(_CASE, inputs)
    assert kept_inputs.sources == inputs.sources
    assert any(flag.citation.excerpt == unmatched_no_cue for flag in digest.review_flags)

    blocked = assess_case(
        _CASE,
        kept_inputs.sources,
        plan_id=inputs.plan_id,
        drug=inputs.drug,
        diagnosis=inputs.diagnosis,
        as_of=inputs.policy_date,
        dob=inputs.dob,
        service_date=inputs.service_date,
    )
    assert not blocked.ready and "source_review" in blocked.blockers
    (review_cite,) = next(f.evidence for f in blocked.findings if f.criterion_id == "source_review")
    assert (
        src.body[review_cite.start : review_cite.end] == unmatched_no_cue
        and review_cite.source_version_id == "gi-note"
    )

    compact = digest_to_source_versions(digest)
    assert all(
        item.source_version_id.endswith(":digest") and item.origin_ref != item.source_version_id
        for item in compact
    )


def test_distill_chart_validates_source_scope_and_digests() -> None:
    bad = _make_source("bad", "Diagnosis: K21.0.").model_copy(update={"body_sha256": "0" * 64})
    with pytest.raises(ValueError, match="source_digest_mismatch"):
        distill_chart(_CASE, [bad])
    dup = _make_source("dup", "Diagnosis: K21.0.")
    with pytest.raises(ValueError, match="duplicate_source_version"):
        distill_chart(_CASE, [dup, dup])
