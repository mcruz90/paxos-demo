"""Bounded public view of a case assessment and its trusted source dependency."""

import os
from dataclasses import replace
from typing import Annotated, Literal

from fastapi import Request
from pydantic import BaseModel, Field

from cases.assessment import assess_case
from cases.assessment_records import Assessment, Citation, Finding
from cases.assessment_sources import PediatricFixtureReader, SourceReader
from cases.pediatric_findings import DRUGS
from models.case_evidence import CaseRecord, Digest, RecordId, Revision


def assessment_reader(request: Request) -> SourceReader:
    return getattr(request.app.state, "assessment_reader", None) or PediatricFixtureReader(
        os.getenv("PEDIATRIC_FIXTURE_CASE_ID")
    )


Text = Annotated[str, Field(min_length=1, max_length=1024)]


class AssessmentCitation(BaseModel):
    source_version_id: RecordId
    source_sha256: Digest
    start: int = Field(ge=0, lt=100000)
    end: int = Field(gt=0, le=100000)
    role: Literal["patient", "context"]
    excerpt: Text


class AssessmentCriterion(BaseModel):
    criterion_id: RecordId
    requirement: Text
    status: Literal["met", "missing", "conflict"]
    next_action: Text | None
    evidence: tuple[AssessmentCitation, ...] = Field(max_length=64)


class CaseAssessment(BaseModel):
    revision: Revision
    findings: tuple[AssessmentCriterion, ...] = Field(max_length=16)
    ready: bool
    pathway: Literal["no_pa_required", "step_therapy", "swallowing", "feeding_tube"] | None
    blockers: tuple[RecordId, ...] = Field(max_length=16)
    policy_sha256: Digest | None
    age_years: int | None = Field(ge=0, le=9998)
    next_action: Text | None


def _public_evidence(row: Finding) -> tuple[Citation, ...]:
    if row.criterion_id == "source_review":
        return ()
    citations = []
    for cite in row.evidence[:64]:
        line = cite.excerpt.strip()
        if row.criterion_id in DRUGS and line.count(":") > 1:
            # Keep a verifiable outcome span. Free-text reasons can contain private dates.
            line = line[: line.index(":", line.index(":") + 1)]
        start = cite.start + len(cite.excerpt) - len(cite.excerpt.lstrip())
        citations.append(replace(cite, start=start, end=start + len(line), excerpt=line))
    return tuple(citations)


def public_assessment(case: CaseRecord, reader: SourceReader) -> CaseAssessment:
    inputs = reader.read(case)
    if inputs is None or not inputs.sources:
        result = Assessment(
            case,
            None,
            None,
            (),
            False,
            None,
            ("sources",),
            "Obtain the source records for this case revision.",
        )
    else:
        result = assess_case(
            case,
            inputs.sources,
            plan_id=inputs.plan_id,
            drug=inputs.drug,
            diagnosis=inputs.diagnosis,
            as_of=inputs.policy_date,
            dob=inputs.dob,
            service_date=inputs.service_date,
        )
    result = replace(
        result,
        findings=tuple(replace(row, evidence=_public_evidence(row)) for row in result.findings),
    )
    return CaseAssessment.model_validate(result, from_attributes=True)
