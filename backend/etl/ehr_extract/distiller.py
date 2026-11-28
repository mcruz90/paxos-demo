"""Deterministic chart fan-out distiller and AssessmentInputs bridge."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from hashlib import sha256

from cases.assessment_records import Citation
from cases.assessment_sources import AssessmentInputs
from etl.ehr_extract.matchers import match_line
from etl.ehr_extract.models import (
    ChartEvidenceDigest,
    CitedRecord,
    ClinicalObservation,
    DiagnosisEvidence,
    LabMeasurement,
    ReviewFlag,
    SourceMetadata,
    SourceSummary,
    SpecialistMarker,
    StepTherapyTrial,
)
from models.case_evidence import CaseRecord, SourceVersion

_LINE_SEPS = "\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029"


def _validate_source(case: CaseRecord, source: SourceVersion, seen: set[str]) -> None:
    if (source.case_id, source.tenant_id) != (case.case_id, case.tenant_id):
        raise ValueError("source_scope_mismatch")
    if source.category == "patient_record" and source.patient_ref != case.patient_ref:
        raise ValueError("source_patient_mismatch")
    if sha256(source.body.encode()).hexdigest() != source.body_sha256:
        raise ValueError("source_digest_mismatch")
    if source.source_version_id in seen:
        raise ValueError("duplicate_source_version")
    seen.add(source.source_version_id)


def _distill_source(
    source: SourceVersion,
    buckets: tuple[
        list[StepTherapyTrial],
        list[LabMeasurement],
        list[SpecialistMarker],
        list[DiagnosisEvidence],
        list[ClinicalObservation],
        list[ReviewFlag],
    ],
    flag_all_unmatched: bool,
) -> SourceSummary:
    trials, labs, specialists, diagnoses, observations, review_flags = buckets
    matched_count = 0
    flag_count = 0
    offset = 0
    for raw in source.body.splitlines(keepends=True):
        line = raw.rstrip(_LINE_SEPS)
        if line.strip():
            result = match_line(
                line,
                Citation.from_line(source, offset, line),
                flag_all_unmatched=flag_all_unmatched,
            )
            trials.extend(result.step_therapy)
            labs.extend(result.labs)
            specialists.extend(result.specialists)
            diagnoses.extend(result.diagnoses)
            observations.extend(result.observations)
            review_flags.extend(result.review_flags)
            matched_count += (
                len(result.step_therapy)
                + len(result.labs)
                + len(result.specialists)
                + len(result.diagnoses)
                + len(result.observations)
            )
            flag_count += len(result.review_flags)
        offset += len(raw)
    return SourceSummary(
        source.source_version_id, matched_count, flag_count, matched_count > 0 or flag_count > 0
    )


def distill_chart(
    case: CaseRecord,
    sources: Iterable[SourceVersion],
    *,
    flag_all_unmatched: bool = False,
) -> ChartEvidenceDigest:
    """Fan out over N canonical sources and emit a compact, cited evidence digest."""
    seen: set[str] = set()
    trials: list[StepTherapyTrial] = []
    labs: list[LabMeasurement] = []
    specialists: list[SpecialistMarker] = []
    diagnoses: list[DiagnosisEvidence] = []
    observations: list[ClinicalObservation] = []
    review_flags: list[ReviewFlag] = []
    summaries: list[SourceSummary] = []
    metadata: list[SourceMetadata] = []
    buckets = (trials, labs, specialists, diagnoses, observations, review_flags)

    for source in sources:
        _validate_source(case, source, seen)
        metadata.append(
            SourceMetadata(
                source.source_version_id,
                source.origin_ref,
                source.category,
                source.patient_ref,
            )
        )
        summaries.append(_distill_source(source, buckets, flag_all_unmatched))

    retained_count = sum(1 for item in summaries if item.retained)
    return ChartEvidenceDigest(
        case_id=case.case_id,
        tenant_id=case.tenant_id,
        patient_ref=case.patient_ref,
        source_count=len(summaries),
        retained_source_count=retained_count,
        step_therapy=tuple(trials),
        labs=tuple(labs),
        specialists=tuple(specialists),
        diagnoses=tuple(diagnoses),
        observations=tuple(observations),
        review_flags=tuple(review_flags),
        source_summaries=tuple(summaries),
        source_metadata=tuple(metadata),
    )


def digest_to_source_versions(
    digest: ChartEvidenceDigest,
    *,
    include_review_flags: bool = True,
) -> tuple[SourceVersion, ...]:
    """Emit compacted summary SourceVersions under linked ':digest' IDs without mutating originals."""
    by_source: dict[str, dict[tuple[int, int], str]] = defaultdict(dict)
    groups: tuple[tuple[CitedRecord, ...], ...] = (
        digest.step_therapy,
        digest.labs,
        digest.specialists,
        digest.diagnoses,
        digest.observations,
        digest.review_flags if include_review_flags else (),
    )
    for group in groups:
        for item in group:
            cite = item.citation
            by_source[cite.source_version_id][(cite.start, cite.end)] = cite.excerpt

    compact: list[SourceVersion] = []
    for meta in digest.source_metadata:
        spans = by_source.get(meta.source_version_id)
        if not spans:
            continue
        body = "\n".join(spans[pos] for pos in sorted(spans))
        compact.append(
            SourceVersion(
                source_version_id=f"{meta.source_version_id}:digest",
                case_id=digest.case_id,
                tenant_id=digest.tenant_id,
                category=meta.category,
                patient_ref=meta.patient_ref,
                body=body,
                body_sha256=sha256(body.encode()).hexdigest(),
                origin_ref=meta.source_version_id,
            )
        )
    return tuple(compact)


def distill_assessment_inputs(
    case: CaseRecord,
    inputs: AssessmentInputs,
) -> tuple[AssessmentInputs, ChartEvidenceDigest]:
    """Distill AssessmentInputs.sources with strict review flagging while keeping original sources intact."""
    digest = distill_chart(case, inputs.sources, flag_all_unmatched=True)
    return inputs, digest
