"""Pure static deterministic matchers for structured chart evidence."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime

from cases.assessment_records import Citation
from cases.pediatric_findings import classify as classify_pediatric
from etl.ehr_extract.models import (
    ClinicalObservation,
    DiagnosisEvidence,
    LabMeasurement,
    ReviewFlag,
    SpecialistMarker,
    SpecialistRole,
    StepTherapyTrial,
    ThresholdRelation,
)
from etl.ehr_extract.patterns import (
    AMBIGUOUS_TRIAL,
    CLINICAL_CUES,
    DATED_TRIAL,
    DIAGNOSIS_LINE,
    ICD10_CODE,
    LAB_ANALYTES,
    LAB_LINE,
    PEDIATRIC_TRIAL,
    SPECIALIST_CONSULT,
    SPECIALIST_PRESCRIBER,
    SPECIALIST_SIGNER,
    THRESHOLD_OPS,
)


@dataclass
class LineMatchResult:
    step_therapy: list[StepTherapyTrial] = field(default_factory=list)
    labs: list[LabMeasurement] = field(default_factory=list)
    specialists: list[SpecialistMarker] = field(default_factory=list)
    diagnoses: list[DiagnosisEvidence] = field(default_factory=list)
    observations: list[ClinicalObservation] = field(default_factory=list)
    review_flags: list[ReviewFlag] = field(default_factory=list)

    @property
    def matched_any(self) -> bool:
        return any(
            (self.step_therapy, self.labs, self.specialists, self.diagnoses, self.observations)
        )


def _parse_slash_date(text: str) -> tuple[date | None, bool]:
    first_s, second_s, _year_s = text.split("/")
    first, second = int(first_s), int(second_s)
    if 1 <= first <= 12 and 1 <= second <= 12 and first != second:
        return None, True
    fmt = "%d/%m/%Y" if first > 12 else "%m/%d/%Y"
    try:
        return datetime.strptime(text, fmt).date(), False
    except ValueError:
        return None, False


def _parse_date_checked(token: str | None) -> tuple[date | None, bool]:
    if not token:
        return None, False
    text = token.strip()
    if "/" in text:
        return _parse_slash_date(text)
    try:
        return date.fromisoformat(text), False
    except ValueError:
        return None, False


def _threshold_relation(value: float, threshold: float | None) -> ThresholdRelation:
    if threshold is None:
        return "unknown"
    if value > threshold:
        return "above"
    if value < threshold:
        return "below"
    return "at"


def _match_dated_trial(dated: re.Match[str], cite: Citation, out: LineMatchResult) -> bool:
    drug = dated.group("drug").strip()
    outcome = dated.group("outcome").strip().lower().replace(" ", "_")
    reason = dated.group("reason").strip() if dated.group("reason") else None
    start, start_ambig = _parse_date_checked(dated.group("start"))
    end, end_ambig = _parse_date_checked(dated.group("end"))
    if start_ambig or end_ambig:
        out.step_therapy.append(StepTherapyTrial(drug, None, None, None, outcome, reason, cite))
        out.review_flags.append(
            ReviewFlag(
                "ambiguous_date_format",
                "Slash date format is ambiguous (MM/DD/YYYY vs DD/MM/YYYY).",
                cite,
            )
        )
        return True
    if start is None or end is None:
        out.review_flags.append(
            ReviewFlag("ambiguous_trial_dates", "Invalid calendar date in trial.", cite)
        )
        return True
    if end < start:
        out.review_flags.append(
            ReviewFlag("invalid_date_range", "Trial end date precedes start date.", cite)
        )
        return True
    # Matches cases/duration_approval.py inclusive day-span rule: (end - start).days + 1.
    days = (end - start).days + 1
    out.step_therapy.append(StepTherapyTrial(drug, start, end, days, outcome, reason, cite))
    return True


def _match_trial(line: str, cite: Citation, out: LineMatchResult) -> bool:
    dated = DATED_TRIAL.fullmatch(line)
    if dated:
        return _match_dated_trial(dated, cite, out)
    ped = PEDIATRIC_TRIAL.fullmatch(line)
    if ped:
        drug = ped[1].lower().removeprefix("prescription ")
        outcome = ped[2].lower() if ped[2] else "prescribed"
        reason = ped[3].strip() if ped[3] and ped[3].strip() else None
        out.step_therapy.append(StepTherapyTrial(drug, None, None, None, outcome, reason, cite))
    return False


def _match_lab(line: str, cite: Citation, out: LineMatchResult) -> bool:
    match = LAB_LINE.fullmatch(line)
    if not match:
        return False
    analyte = match.group("analyte").strip()
    if analyte.casefold() not in LAB_ANALYTES:
        return False
    val, unit = float(match.group("val")), match.group("unit")
    raw_op = match.group("op")
    op = THRESHOLD_OPS.get(raw_op.upper()) if raw_op else None
    tval = float(match.group("tval")) if match.group("tval") else None
    tunit = match.group("tunit")
    if tunit and tunit.casefold() != unit.casefold():
        out.review_flags.append(
            ReviewFlag("ambiguous_threshold", f"Unit mismatch between {unit} and {tunit}.", cite)
        )
        return True
    obs_date, _ = _parse_date_checked(match.group("obs_date"))
    out.labs.append(
        LabMeasurement(
            analyte, val, unit, op, tval, tunit, _threshold_relation(val, tval), obs_date, cite
        )
    )
    return True


def _match_specialist(line: str, cite: Citation, out: LineMatchResult) -> bool:
    patterns: tuple[tuple[SpecialistRole, re.Pattern[str]], ...] = (
        ("prescriber", SPECIALIST_PRESCRIBER),
        ("signer", SPECIALIST_SIGNER),
        ("consultant", SPECIALIST_CONSULT),
    )
    for role_kind, pattern in patterns:
        match = pattern.fullmatch(line)
        if match:
            signed_date, _ = _parse_date_checked(match.group("dt"))
            out.specialists.append(
                SpecialistMarker(
                    role_kind,
                    match.group("clinician").strip(),
                    match.group("specialty").strip(),
                    signed_date,
                    cite,
                )
            )
            return True
    if line.casefold().startswith("signed prescriber attestation: "):
        out.specialists.append(
            SpecialistMarker("attestation", "prescriber", "attestation", None, cite)
        )
    return False


def _match_diagnosis(line: str, cite: Citation, out: LineMatchResult) -> bool:
    match = DIAGNOSIS_LINE.fullmatch(line)
    if not match:
        return False
    body = match.group("body").strip()
    confirmed_date, _ = _parse_date_checked(match.group("dt"))
    out.diagnoses.append(
        DiagnosisEvidence(tuple(ICD10_CODE.findall(body)), body, confirmed_date, cite)
    )
    return True


def _collect_pediatric(stripped: str, cite: Citation, out: LineMatchResult) -> bool:
    for key, value in classify_pediatric(stripped):
        if key == "source_review":
            continue
        out.observations.append(ClinicalObservation(key, value, cite))
        if key == "swallowing" and value == "review":
            out.review_flags.append(
                ReviewFlag(
                    "ambiguous_clinical_statement",
                    "Swallowing statement requires clinical review.",
                    cite,
                )
            )
            return True
    return False


def _flag_unmatched(
    stripped: str, cite: Citation, out: LineMatchResult, flag_all_unmatched: bool
) -> None:
    if AMBIGUOUS_TRIAL.search(stripped):
        out.review_flags.append(
            ReviewFlag(
                "ambiguous_trial_dates",
                "Step-therapy statement lacks deterministic start/end dates.",
                cite,
            )
        )
    elif flag_all_unmatched or CLINICAL_CUES.search(stripped):
        out.review_flags.append(
            ReviewFlag(
                "unrecognized_clinical_statement",
                "Clinical statement outside supported structured formats.",
                cite,
            )
        )


def match_line(line: str, cite: Citation, *, flag_all_unmatched: bool = False) -> LineMatchResult:
    """Match one trimmed line deterministically against all static extractors."""
    out = LineMatchResult()
    stripped = line.strip()
    if not stripped or re.match(r"^(?:header|section|note\s+title)\s*:", stripped, re.IGNORECASE):
        return out
    matched = (
        _match_trial(stripped, cite, out)
        or _match_lab(stripped, cite, out)
        or _match_specialist(stripped, cite, out)
    )
    dx_matched = _match_diagnosis(stripped, cite, out)
    if _collect_pediatric(stripped, cite, out):
        return out
    if not (out.matched_any or out.review_flags or matched or dx_matched):
        _flag_unmatched(stripped, cite, out, flag_all_unmatched)
    return out
