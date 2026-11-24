"""Bounded public view of a case assessment and its trusted source dependency."""

from dataclasses import asdict
from typing import Annotated, Literal

from fastapi import Request
from pydantic import BaseModel, Field

from cases.assessment import assess_case
from cases.assessment_records import MAX_AGE_YEARS, Assessment, Finding
from cases.assessment_sources import SourceReader
from cases.duration_approval import DurationApproval
from models.case_evidence import CaseRecord, Digest, RecordId, Revision


def assessment_reader(request: Request) -> SourceReader:
    return request.app.state.assessment_reader


Text = Annotated[str, Field(min_length=1, max_length=1024)]


class AssessmentCitation(BaseModel):
    source_version_id: RecordId
    source_sha256: Digest
    start: int = Field(ge=0, lt=100000)
    end: int = Field(gt=0, le=100000)
    role: Literal["patient", "context"]
    excerpt: Text | None


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
    duration_approval: DurationApproval | None = None
    age_years: int | None = Field(ge=0, le=MAX_AGE_YEARS)
    next_action: Text | None


def _public_criterion(row: Finding) -> AssessmentCriterion:
    evidence = []
    for cite in row.evidence[:64]:
        fields = asdict(cite)
        if row.criterion_id == "source_review":
            fields["excerpt"] = None
        else:
            # Only surrounding whitespace falls outside the recognized statement.
            line = cite.excerpt.strip()
            fields["start"] += len(cite.excerpt) - len(cite.excerpt.lstrip())
            fields.update(end=fields["start"] + len(line), excerpt=line)
        evidence.append(AssessmentCitation.model_validate(fields))
    return AssessmentCriterion(
        criterion_id=row.criterion_id,
        requirement=row.requirement,
        status=row.status,
        next_action=row.next_action,
        evidence=tuple(evidence),
    )


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
            duration_decision=inputs.duration_decision,
        )
    return CaseAssessment.model_validate(
        {
            "revision": result.revision,
            "findings": tuple(map(_public_criterion, result.findings)),
            "ready": result.ready,
            "pathway": result.pathway,
            "blockers": result.blockers,
            "policy_sha256": result.policy_sha256,
            "age_years": result.age_years,
            "duration_approval": result.duration_approval,
            "next_action": result.next_action,
        }
    )
