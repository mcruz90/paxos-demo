"""Read bounded, whole-line observations in original synthetic chart documents.

An unrecognized patient line requires review. Never infer a negative observation
from an absent mention, or upgrade a context citation to a patient observation.
"""

import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from hashlib import sha256

from cases.assessment_records import Citation, Finding
from models.case_evidence import CaseRecord, SourceVersion

DRUGS = ("omeprazole", "pantoprazole", "rabeprazole")
ACTIONS = {
    "diagnosis": "Document an indication compatible with the pediatric GERD policy.",
    "age": "Confirm the patient's age on the claim date of service.",
    **{
        d: f"Document the reason for {d} failure, contraindication, or intolerance"
        + (" for a prescription formulation." if d == "omeprazole" else ".")
        for d in DRUGS
    },
    "swallowing": "Obtain a patient-specific swallowing evaluation addressing whole tablets or capsules.",
    "feeding_tube": "Obtain the chart record documenting medication administration via feeding tube.",
    "attestation": "Obtain the requested prescriber attestation for swallowing limitation.",
    "source_review": "Review chart statements outside the supported observation format.",
}
LABELS = {
    "diagnosis": "Diagnosis compatible with the pediatric GERD policy.",
    "age": "Patient age on the claim date of service.",
    **{
        d: f"Documented failure, contraindication, or intolerance to {d} with a stated reason."
        for d in DRUGS
    },
    "omeprazole": "Documented failure, contraindication, or intolerance to prescription omeprazole with a stated reason.",
    "swallowing": "Inability to swallow whole tablets or capsules.",
    "feeding_tube": "Medication administration via feeding tube.",
    "attestation": "Signed prescriber attestation for the reported swallowing limitation.",
    "source_review": "Clinical review of unrecognized chart statements.",
}
AGE = re.compile(r"age at request: (\d{1,3}) years?\.")
TRIAL = re.compile(
    r"(prescription omeprazole|pantoprazole|rabeprazole): "
    r"(?:(failure|contraindication|intolerance)(?:: (.{1,300}))?|prescribed)\.",
    re.IGNORECASE | re.ASCII,
)
SWALLOW = re.compile(
    r"unable to swallow whole tablets or capsules due to (age|dysphagia|oral/motor difficulties)\."
)
SIGNED = "signed prescriber attestation: "
STATEMENTS = {
    "diagnosis: k21.0.": ("diagnosis", "yes"),
    "diagnosis: gerd with erosive esophagitis.": ("diagnosis", "yes"),
    "medications administered via feeding tube.": ("feeding_tube", "yes"),
    "medications not administered via feeding tube.": ("feeding_tube", "no"),
    "able to swallow whole tablets or capsules.": ("swallowing", "no"),
    "tolerates crushed medication.": ("swallowing", "review"),
    "prescriber attestation requested: swallowing limitation.": ("attestation", "requested"),
}


def classify(line: str) -> tuple[tuple[str, str], ...]:
    text = line.strip().casefold()
    age = AGE.fullmatch(text)
    if age:
        return (("age", str(int(age[1]))),)
    trial = TRIAL.fullmatch(line.strip())
    if trial:
        drug = trial[1].lower().removeprefix("prescription ")
        if trial[2] is None:
            return ((drug, "unknown"),)
        if trial[3] and trial[3].strip():
            return ((drug, "yes"),)
        return ((drug, trial[2].lower()),)
    if SWALLOW.fullmatch(text):
        return (("swallowing", "yes"),)
    if text.startswith(SIGNED) and SWALLOW.fullmatch(text.removeprefix(SIGNED)):
        return (("swallowing", "yes"), ("attestation", "yes"))
    return (STATEMENTS.get(text, ("source_review", "unknown")),)


@dataclass(frozen=True)
class Observation:
    value: str
    citation: Citation


def observations(
    case: CaseRecord, sources: Iterable[SourceVersion]
) -> dict[str, list[Observation]]:
    rows: dict[str, list[Observation]] = defaultdict(list)
    seen: set[str] = set()
    for source in sources:
        if (source.case_id, source.tenant_id) != (case.case_id, case.tenant_id):
            raise ValueError("source_scope_mismatch")
        if source.category == "patient_record" and source.patient_ref != case.patient_ref:
            raise ValueError("source_patient_mismatch")
        if sha256(source.body.encode()).hexdigest() != source.body_sha256:
            raise ValueError("source_digest_mismatch")
        if source.source_version_id in seen:
            raise ValueError("duplicate_source_version")
        seen.add(source.source_version_id)
        offset = 0
        for raw in source.body.splitlines(keepends=True):
            line = raw.rstrip("\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029")
            if line.strip():
                cite = Citation.from_line(source, offset, line)
                for key, value in classify(line):
                    rows[key].append(Observation(value, cite))
            offset += len(raw)
    return rows


def patient_values(items: list[Observation]) -> set[str]:
    return {item.value for item in items if item.citation.role == "patient"}


def finding(key: str, items: list[Observation]) -> Finding:
    values = patient_values(items)
    cites = tuple(item.citation for item in items)
    disputed = "yes" in values and bool(values & {"no", "review"})
    if disputed or (key == "age" and len(values) > 1):
        return Finding(
            key,
            LABELS[key],
            "conflict",
            "Patient records require reconciliation.",
            f"Reconcile the cited records for {key.replace('_', ' ')}.",
            cites,
        )
    if "yes" in values or (key == "age" and values):
        return Finding(
            key, LABELS[key], "met", "Documented in the cited patient record.", None, cites
        )
    action = ACTIONS[key]
    if key in DRUGS:
        reasons_needed = sorted(values & {"failure", "contraindication", "intolerance"})
        if reasons_needed:
            action = " ".join(
                f"Document the reason for {key} {outcome}." for outcome in reasons_needed
            )
    return Finding(
        key, LABELS[key], "missing", "Patient documentation is insufficient.", action, cites
    )
