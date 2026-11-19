"""Field extraction for ClearAuth's denial-letter ETL.

Reads already-sanitized denial text. Case intake passes the tokenized version after its hold checks.

Order of evidence for each field: a labelled field ("Plan ID:", "Drug name |") beats a phrase
("coverage for X"), which beats a generic fallback. The member ID is extracted separately and is
never used as the plan ID. Every value fits ClearAuth's AppealRequest length limits.

Each field also reports its evidence -- "label", "phrase", "fallback" or "none" -- so the caller
can route weak extractions (fallback/none) to an LLM pass or a human instead of trusting them.

Drug identity (PRD FR-9) is passed in, so this module stays standard library only: `drug_agrees(name, ndcs)` is
asked about a drug read with label or phrase evidence and the NDCs the letter prints; when it says no (the letter
names two drugs, or its NDC is another product), the drug keeps its value but drops to fallback evidence. In this
repo the check is rxnorm.letter_check.checker; without one, nothing changes.

The payer list is passed in too (`payers`, ClearAuth's own payers): a labelled plan name comes first; without
one, a payer the letter names anywhere (a letterhead, a FROM line, prose) is read when it is the only known
payer named. Two known payers give no answer. Without a list, nothing changes.
"""

import re
from bisect import bisect_left, bisect_right
from collections.abc import Callable, Collection
from dataclasses import dataclass, field

from etl.denial_letter.field_patterns import (
    _ABBREVIATIONS,
    _CLAUSE_END,
    _CLAUSE_WINDOW,
    _DIAGNOSIS,
    _DRUG_PATTERNS,
    _FIELD_LINE,
    _I,
    _ICD,
    _MEMBER_ID,
    _NDC,
    _NOT_A_DRUG,
    _NOT_REQUESTED,
    _PLAN_ID_PATTERNS,
    _PLAN_NAME,
    _REASON_PATTERNS,
    _TRADEMARKS,
    FALLBACK,
    LABEL,
    NONE,
    PHRASE,
)

UNKNOWN_DRUG = "Unknown Drug"
UNKNOWN_DIAGNOSIS = "Unknown Diagnosis"
UNSPECIFIED_REASON = "Not specified"
UNKNOWN_PLAN = "Unknown Plan"
UNKNOWN_PLAN_ID = "UNKNOWN"
PLACEHOLDERS = frozenset(
    {UNKNOWN_DRUG, UNKNOWN_DIAGNOSIS, UNSPECIFIED_REASON, UNKNOWN_PLAN, UNKNOWN_PLAN_ID}
)
MAX_TEXT, MAX_PLAN_ID, MAX_REASON, MAX_CODES = 200, 100, 500, 5


@dataclass(frozen=True)
class DenialFields:
    drug: str
    diagnosis: str
    denial_reason: str
    plan: str
    plan_id: str
    member_id: str = ""
    icd_codes: list[str] = field(default_factory=list)
    ndcs: list[str] = field(default_factory=list)
    evidence: dict[str, str] = field(default_factory=dict)


def _clip(text: str, limit: int = MAX_TEXT) -> str:
    return " ".join(text.split())[:limit].strip()


def _clean_drug(value: str) -> str:
    value = value.translate({ord(c): None for c in _TRADEMARKS})
    return _clip(value.strip(" .,;:-"))


def _clause_ends(text: str) -> tuple[list[int], list[int]]:
    """Where each clause end starts and stops, found once per letter (ascending)."""
    found = list(_CLAUSE_END.finditer(text))
    return [m.start() for m in found], [m.end() for m in found]


def is_requested(
    text: str, start: int, end: int, bounds: tuple[list[int], list[int]] | None = None
) -> bool:
    """False when the mention's own clause says the drug is history or an alternative (decision 0037).

    The clause runs from the clause end before text[start:end] to the one after it, and at most _CLAUSE_WINDOW
    characters either side, so each mention costs a bounded search however long the letter is."""
    starts, ends = bounds or _clause_ends(text)
    i, j = bisect_right(ends, start), bisect_left(starts, end)
    left = max(ends[i - 1] if i else 0, start - _CLAUSE_WINDOW)
    right = min(starts[j] if j < len(starts) else len(text), end + _CLAUSE_WINDOW)
    return not _NOT_REQUESTED.search(text[left:right])


def extract_drug(text: str) -> tuple[str, str]:
    bounds = None
    rejected = False
    for rx, evidence in _DRUG_PATTERNS:
        for m in rx.finditer(text):
            value = _clean_drug(m.group("v"))
            if evidence != LABEL:  # a labelled "Drug requested:" line is the request by definition
                bounds = bounds or _clause_ends(text)
                if not is_requested(text, m.start("v"), m.end("v"), bounds):
                    rejected = True  # the cue may have discarded the requested drug
                    continue
            if value and not _NOT_A_DRUG.match(value):
                # A phrase cut off at a comma may be a truncated multi-part name: don't trust it.
                cut_at_comma = evidence != LABEL and text[m.end() : m.end() + 1] == ","
                return value, FALLBACK if rejected or cut_at_comma else evidence
    return UNKNOWN_DRUG, NONE


def extract_ndcs(text: str) -> list[str]:
    """NDCs as the letter labels and writes them; reading one (hyphens, 10 or 11 digits) is the check's job."""
    return list(dict.fromkeys(_NDC.findall(text)))


def extract_member_id(text: str) -> str:
    for m in _MEMBER_ID.finditer(text):
        if re.search(r"\d", m.group(1)):
            return m.group(1)
    return ""


def extract_plan_id(text: str, member_id: str = "") -> tuple[str, str]:
    for rx, evidence in _PLAN_ID_PATTERNS:
        for m in rx.finditer(text):
            value = m.group(1)
            if re.search(r"\d", value) and value != member_id:
                return value[:MAX_PLAN_ID], evidence
    return UNKNOWN_PLAN_ID, NONE


def _sentence_end(rest: str) -> int:
    """Index where the sentence starting at rest[0] ends; decimals and abbreviations don't end it."""
    stop = len(rest)
    for rx in (re.compile(r"\n[ \t]*\n"), _FIELD_LINE):
        m = rx.search(rest)
        if m:
            stop = min(stop, m.start())
    for m in re.finditer(r"\.(?=\s|$)", rest[:stop]):
        word = re.search(r"([A-Za-z.]+)$", rest[: m.start()])
        if not (word and word.group(1).lower().rstrip(".") in _ABBREVIATIONS):
            return m.start()
    return stop


def extract_reason(text: str) -> tuple[str, str]:
    for rx, evidence in _REASON_PATTERNS:
        m = rx.search(text)
        if m:
            rest = text[m.end() :]
            reason = _clip(rest[: _sentence_end(rest)], MAX_REASON)
            if reason:
                return reason, evidence
    return UNSPECIFIED_REASON, NONE


def extract_codes(text: str, is_valid_code: Callable[[str], bool] | None = None) -> list[str]:
    codes: list[str] = []
    for code in _ICD.findall(text):
        if code not in codes and (is_valid_code is None or is_valid_code(code)):
            codes.append(code)
    return codes[:MAX_CODES]


def extract_diagnosis(text: str, codes: list[str]) -> str:
    m = _DIAGNOSIS.search(text)
    if m:
        value = re.sub(r"\([^)]*\)", "", m.group("v"))
        value = _ICD.sub("", value).strip(" .,;:-")
        return _clip(value) or (_ICD.findall(m.group("v")) or [UNKNOWN_DIAGNOSIS])[0]
    return codes[0] if codes else UNKNOWN_DIAGNOSIS


def _named(text: str, payers: Collection[str]) -> list[str]:
    """The known payers the text names, each as a whole word, in the list's spelling."""
    return [
        p
        for p in payers
        if p and re.search(rf"(?<![A-Za-z0-9]){re.escape(p)}(?![A-Za-z0-9])", text, _I)
    ]


def extract_plan(text: str, payers: Collection[str] = ()) -> str:
    m = _PLAN_NAME.search(text)
    if m:
        name = re.split(r"[|(,]", m.group("v"))[0].strip(" .:-")
        if name and name[0].isalpha():
            known = _named(name, payers)
            return known[0] if len(known) == 1 else _clip(name)
    named = _named(text, payers)
    return named[0] if len(named) == 1 else UNKNOWN_PLAN


def extract_fields(
    text: str,
    is_valid_code: Callable[[str], bool] | None = None,
    drug_agrees: Callable[[str, list[str]], bool] | None = None,
    payers: Collection[str] = (),
) -> DenialFields:
    """Extract every field ClearAuth's AppealRequest needs from sanitized letter text."""
    member_id = extract_member_id(text)
    codes = extract_codes(text, is_valid_code)
    drug, drug_ev = extract_drug(text)
    ndcs = extract_ndcs(text)
    if drug_agrees is not None and drug_ev in (LABEL, PHRASE) and not drug_agrees(drug, ndcs):
        drug_ev = FALLBACK
    reason, reason_ev = extract_reason(text)
    plan_id, plan_id_ev = extract_plan_id(text, member_id)
    return DenialFields(
        drug=drug,
        diagnosis=extract_diagnosis(text, codes),
        denial_reason=reason,
        plan=extract_plan(text, payers),
        plan_id=plan_id,
        member_id=member_id,
        icd_codes=codes,
        ndcs=ndcs,
        evidence={
            "drug": drug_ev,
            "denial_reason": reason_ev,
            "plan_id": plan_id_ev,
            "icd10": LABEL if codes else NONE,
        },
    )
