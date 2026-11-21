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
LABELS = {
    "diagnosis": "Document an indication compatible with the pediatric GERD policy.",
    "age": "Age at request determines automatic processing below age six.",
    **{
        d: f"Document {d} failure, contraindication, or intolerance"
        + (" for a prescription formulation." if d == "omeprazole" else ".")
        for d in DRUGS
    },
    "swallowing": "Unable to swallow whole tablets or capsules due to age, oral/motor difficulty, or dysphagia.",
    "feeding_tube": "Medications administered via feeding tube.",
    "attestation": "Obtain the requested prescriber attestation for swallowing limitation.",
    "source_review": "Review chart statements outside the supported observation format.",
}
ACTIONS = {
    **LABELS,
    "age": "Confirm the patient's age on the request date.",
    "swallowing": "Obtain a patient-specific swallowing evaluation addressing whole tablets or capsules.",
    "feeding_tube": "Obtain the chart record documenting medication administration via feeding tube.",
}
AGE = re.compile(r"age at request: (\d{1,3}) years?\.")
TRIAL = re.compile(
    r"(prescription omeprazole|pantoprazole|rabeprazole): (failure|contraindication|intolerance|prescribed)\."
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
    if age and int(age[1]) <= 125:
        return (("age", str(int(age[1]))),)
    trial = TRIAL.fullmatch(text)
    if trial:
        outcome = "unknown" if trial[2] == "prescribed" else "yes"
        return ((trial[1].removeprefix("prescription "), outcome),)
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
            line = raw.rstrip("\r\n")
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
    return Finding(
        key, LABELS[key], "missing", "Patient documentation is insufficient.", ACTIONS[key], cites
    )
