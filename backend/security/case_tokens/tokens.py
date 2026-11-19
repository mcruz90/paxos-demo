"""Typed tokens in and out: the reversible half of ClearAuth's tokenization boundary (ADR-0014). Standard library.

A detector (regex, or a PII model) finds spans. This module decides whose identifier each span is (the
patient's or the prescriber's), names the tokens and rebuilds the text. It also does the reverse:

    tokenize(text, spans, specialty) -> Tokenized(text, mapping)  {{PATIENT_NAME_1}}, {{ENDOCRINOLOGIST_PHONE_1}}
    tokenize(text, spans, specialty, mapping, reserved) -> the same, with that mapping extended (one table per case)
    literals(texts)               -> every token-shaped string in a case's texts: reserve them before the first
    rehydrate(text, mapping)      -> Rehydrated(text, unresolved)

Tokens are numbered per distinct value, so the mapping is one-to-one and rehydration is exact. The mapping is
PHI: it is kept apart from the tokenized case and never written into it. Rehydration fills only tokens that are
exactly in the mapping. A token the mapping doesn't have (an LLM made it up), or a token-like string that
isn't exact ("{{ PATIENT NAME }}"), is left in place and reported, never guessed. A token-shaped string already
in the input is never issued, so it stays literal and is reported too: it can't resolve to an identity.

A case's documents can share one table (decision 0006, update 2026-11-16): each is tokenized on its own, with the
table so far passed in, so a value gets the same token in every document and one mapping restores them all. A
caller that shares a table passes `reserved=literals(every text of the case)`, so no document is issued a token
another document holds as text (that literal would resolve to a person). A text that holds a token the table
already issued, or a reserved literal the table issued, is refused.
"""

import re
from collections.abc import Callable, Collection, Iterable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from security.case_tokens.residual import Residual

# the last three are read by position in HL7 and FHIR inputs (fields.py, decision 0030)
PATIENT_KINDS = (
    *("PATIENT_NAME", "DOB", "MEMBER_ID", "ADDRESS", "PHONE", "EMAIL", "CLAIM_NUMBER"),
    *("MRN", "ACCOUNT_NUMBER", "SSN"),
)
PRESCRIBER_KINDS = {
    "PRESCRIBER_NAME": "NAME",
    "PRESCRIBER_PHONE": "PHONE",
    "PRESCRIBER_EMAIL": "EMAIL",
    "PRESCRIBER_NPI": "NPI",
}
TOKEN = re.compile(r"\{\{[A-Z][A-Z0-9_]*_\d+\}\}")
_ISSUED = re.compile(r"\{\{([A-Z][A-Z0-9_]*)_(\d+)\}\}")  # a token's kind and number
TOKEN_LIKE = re.compile(r"(?<!\{)\{\{[^{}\n]{1,60}\}\}(?!\})")
_CONTACT_CUE = re.compile(
    r"\b(?:office|clinic|practice|fax|prescriber|medical group|NPI)\b", re.IGNORECASE
)
_DR = re.compile(r"\bDr\.?\s*$")
_SHORT_LINE = (
    60  # letterhead lines are short; a sentence that mentions the doctor is not letterhead
)
_PATIENT_CUE = re.compile(r"\b(?:patient|member|enrollee|subscriber)\b", re.IGNORECASE)


@dataclass(frozen=True)
class Span:
    start: int
    end: int
    kind: str  # one of PATIENT_KINDS or PRESCRIBER_KINDS


@dataclass
class Tokenized:
    text: str
    mapping: dict[str, str] = field(default_factory=dict)
    residual: "Residual | None" = None  # the output check's verdict (combine only, decision 0034)


@dataclass
class Rehydrated:
    text: str
    unresolved: list[str] = field(default_factory=list)


def resolve_overlaps(spans: list[Span]) -> list[Span]:
    """Earliest first, longest first at the same start; any span overlapping a kept one is dropped."""
    kept: list[Span] = []
    for s in sorted(spans, key=lambda s: (s.start, -(s.end - s.start))):
        if s.end > s.start and (not kept or s.start >= kept[-1].end):
            kept.append(s)
    return kept


def _line(text: str, pos: int) -> tuple[int, int]:
    start = text.rfind("\n", 0, pos) + 1
    end = text.find("\n", pos)
    return start, len(text) if end < 0 else end


def _block(text: str, pos: int) -> list[tuple[int, int]]:
    """The lines of the paragraph (no blank line between) that holds pos."""
    start = text.rfind("\n\n", 0, pos)
    start = 0 if start < 0 else start + 2
    end = text.find("\n\n", pos)
    end = len(text) if end < 0 else end
    out, i = [], start
    while i <= end:
        j = text.find("\n", i, end)
        j = end if j < 0 else j
        out.append((i, j))
        i = j + 1
    return out


def assign_roles(text: str, spans: list[Span]) -> list[Span]:
    """A name after "Dr." is the prescriber's; so is every other mention of that name. A phone or email is the
    prescriber's when it is on a prescriber's line, on the line after a prescriber's name, on a short line of the
    prescriber's letterhead block, or on a line about the office, clinic or fax. Everything else stays the
    patient's."""
    spans = [
        Span(s.start, s.end, "PRESCRIBER_NAME")
        if s.kind == "PATIENT_NAME" and _DR.search(text[max(0, s.start - 5) : s.start])
        else s
        for s in spans
    ]
    names = {text[s.start : s.end].casefold() for s in spans if s.kind == "PRESCRIBER_NAME"}
    spans = [
        Span(s.start, s.end, "PRESCRIBER_NAME")
        if s.kind == "PATIENT_NAME" and text[s.start : s.end].casefold() in names
        else s
        for s in spans
    ]
    lines = {_line(text, s.start) for s in spans if s.kind in ("PRESCRIBER_NAME", "PRESCRIBER_NPI")}
    after = {_line(text, end + 1) for _, end in lines if end < len(text)}
    letterhead = {
        line
        for start, _ in lines
        for line in _block(text, start)
        if line[1] - line[0] <= _SHORT_LINE and not _PATIENT_CUE.search(text[line[0] : line[1]])
    }

    def prescribers(s: Span) -> bool:
        line = _line(text, s.start)
        return (
            line in lines
            or line in after
            or line in letterhead
            or bool(_CONTACT_CUE.search(text[line[0] : line[1]]))
        )

    return [
        Span(s.start, s.end, f"PRESCRIBER_{s.kind}")
        if s.kind in ("PHONE", "EMAIL") and prescribers(s)
        else s
        for s in spans
    ]


def token_kind(kind: str, role: str) -> str:
    return f"{role}_{PRESCRIBER_KINDS[kind]}" if kind in PRESCRIBER_KINDS else kind


def split_name(raw: str) -> tuple[str, str]:
    """(first, last) from "First Last" or "Last, First"."""
    parts = [p for p in re.split(r",\s*|\s", raw.strip()) if p]
    return (parts[1], parts[0]) if "," in raw else (parts[0], parts[-1])


def prescriber_groups(text: str, spans: list[Span]) -> dict[int, int]:
    """Which prescriber each prescriber span belongs to (span index -> group). A name belongs with every other
    mention of the same surname; an NPI, phone or email belongs with the nearest name before it (or, with none
    before it, the first one after). A letter can name two prescribers: one who prescribed and one consulted."""
    names = [
        (i, split_name(text[s.start : s.end])[1].casefold())
        for i, s in enumerate(spans)
        if s.kind == "PRESCRIBER_NAME"
    ]
    surnames = list(dict.fromkeys(last for _, last in names))
    groups = {i: surnames.index(last) for i, last in names}
    for i, s in enumerate(spans):
        if s.kind in PRESCRIBER_KINDS and i not in groups and names:
            before = [j for j, _ in names if spans[j].start < s.start]
            groups[i] = groups[before[-1] if before else names[0][0]]
    return groups


Specialty = Callable[[str | None, tuple[str, str] | None], str]


def _roles(
    text: str, spans: list[Span], groups: dict[int, int], specialty: Specialty
) -> dict[int, str]:
    """The role of each prescriber group: by its NPI, else by its full name."""
    roles = {}
    for g in set(groups.values()):
        members = [spans[i] for i, gi in groups.items() if gi == g]
        npi = next((text[s.start : s.end] for s in members if s.kind == "PRESCRIBER_NPI"), None)
        full = next(
            (
                text[s.start : s.end]
                for s in members
                if s.kind == "PRESCRIBER_NAME"
                and re.search(r"[\s,]", text[s.start : s.end].strip())
            ),
            None,
        )
        roles[g] = specialty(npi, split_name(full) if full else None)
    return roles


def _next_token(kind: str, numbers: dict[str, int], reserved: set[str]) -> str:
    """The kind's next numbered token that isn't already in the input."""
    while True:
        numbers[kind] = numbers.get(kind, 0) + 1
        token = "{{" + f"{kind}_{numbers[kind]}" + "}}"
        if token not in reserved:
            return token


def _table(mapping: dict[str, str]) -> tuple[dict[tuple[str, str], str], dict[str, int]]:
    """A table passed in, read back: (kind, value) -> token, and each kind's highest number."""
    by_value: dict[tuple[str, str], str] = {}
    numbers: dict[str, int] = {}
    for token, value in mapping.items():
        m = _ISSUED.fullmatch(token)
        if m is None:
            raise ValueError("the mapping holds a key that is not a token")
        by_value.setdefault((m.group(1), value), token)
        numbers[m.group(1)] = max(numbers.get(m.group(1), 0), int(m.group(2)))
    return by_value, numbers


def literals(texts: Iterable[str]) -> frozenset[str]:
    """Every token-shaped string in `texts` (a case's documents, as they will be tokenized)."""
    return frozenset(t for text in texts for t in TOKEN.findall(text))


def tokenize(
    text: str,
    spans: list[Span],
    specialty: Specialty,
    mapping: dict[str, str] | None = None,
    reserved: Collection[str] = (),
) -> Tokenized:
    """Replace each span with its token; the same value always gets the same token. Each prescriber's tokens
    carry that prescriber's own specialty. With `mapping` (the case's table so far), its tokens are reused and
    the result's mapping is that table extended; the table passed in is not changed. `reserved`: tokens never
    to issue (literals(), the token-shaped strings of every document of the case)."""
    spans = resolve_overlaps(spans)
    groups = prescriber_groups(text, spans)
    roles = _roles(text, spans, groups, specialty)
    reserved = set(TOKEN.findall(text)) | set(reserved)
    mapping = dict(mapping or {})
    if reserved & mapping.keys():
        raise ValueError(
            "the text holds a token the mapping already issued, or a reserved one is issued"
        )
    by_value, numbers = _table(mapping)
    out, pos = [], 0
    for i, s in enumerate(spans):
        value, kind = (
            text[s.start : s.end],
            token_kind(s.kind, roles.get(groups.get(i, -1), "PRESCRIBER")),
        )
        token = by_value.get((kind, value))
        if token is None:
            token = by_value[(kind, value)] = _next_token(kind, numbers, reserved)
            mapping[token] = value
        out += [text[pos : s.start], token]
        pos = s.end
    out.append(text[pos:])
    return Tokenized("".join(out), mapping)


def rehydrate(text: str, mapping: dict[str, str]) -> Rehydrated:
    """Put the identities back; report every token-like string the mapping can't fill exactly."""
    unresolved = [m.group() for m in TOKEN_LIKE.finditer(text) if m.group() not in mapping]
    filled = TOKEN.sub(lambda m: mapping.get(m.group(), m.group()), text)
    return Rehydrated(filled, unresolved)
