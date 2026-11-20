"""Combine detector spans and verify the tokenized text.

Known and structured identifiers take precedence over heuristic protections
for clinical terms and plan IDs. Fixed control constants can suppress spans
only with a known member ID. Their values reach the residual check so that
copies elsewhere still hold the document.
"""

import re
from collections.abc import Collection

from security.case_tokens import fields, kinship, known_facts, known_identity, residual
from security.case_tokens.deidentify import MAX_INPUT, PARTICLES, name_forms, prescriber_role
from security.case_tokens.npi import Registry
from security.case_tokens.places import copies
from security.case_tokens.protect import kept
from security.case_tokens.tokens import Span, Tokenized, assign_roles, tokenize

# credentials, ID labels and clinical abbreviations alone are no "LAST, FIRST" name ("MD, NPI", "MRI, CT"; "DO, MINH"
# still is one: Do is a surname). Decision 0047, update "criteria check"
CREDENTIALS = frozenset(
    "md do np pa pa-c rn aprn fnp cnp pharmd dds dmd dpm phd npi dea "  # credentials and ID labels
    "mri ct pet cabg pci bmi nsaid dmard snri esr ccp igra tst gerd".split()  # clinical abbreviations
)
_TITLE = re.compile(r"^(?:Dr|Mr|Mrs|Ms|Miss)\.?\s+")
_CAPS_FIRST = re.compile(r",[ \t]*[A-Z][A-Z'\-]+\b")
_CAPS = r"[A-Z][A-Z'\-]+"
_CAPS_PARTICLE = (
    "(?:" + "|".join(re.escape(p.upper()) for p in sorted(PARTICLES, key=len, reverse=True)) + ")"
)
_CAPS_NAME = re.compile(  # "LINDQVIST, HIRO", "DE LA CRUZ, NGOZI", "HUANG, MEI L"; a heading goes on in capitals
    rf"(?<![A-Za-z'\-])(?<![A-Z'\-][ \t])"
    rf"(?P<name>(?:{_CAPS_PARTICLE}[ \t])*{_CAPS},[ \t]*{_CAPS}(?: [A-Z][A-Z'\-]*)?)\b"
    r"(?! [A-Z][A-Z'\-])(?![ \t]+\d{5}\b)"
)
_ICD = re.compile(
    r"\b[A-TV-Z]\d[0-9A-Z](?:\.[0-9A-Z]{1,4})?\b"
)  # ICD-10-CM shape: E11.65, M06, K21.0
_LONG_NUMBER = re.compile(
    r"(?<![\w$.,-])[A-Z]{0,4}\d{9,}(?![\w-]|[.,]\d)"
)  # may have a short prefix: W100000000
_CLAIM_CUE = re.compile(r"claim|reference|\bref\b|case", re.IGNORECASE)
NAME_KINDS = ("PATIENT_NAME", "PRESCRIBER_NAME")


def long_numbers(text: str) -> list[Span]:
    """Every bare run of nine or more digits, with up to four capitals before it: a claim, reference or case number
    after such a word, an NPI after "NPI", else a member ID. Nothing else in a prior authorization letter is that
    long without separators (plan IDs are protected)."""
    out = []
    for m in _LONG_NUMBER.finditer(text):
        before = text[max(0, m.start() - 20) : m.start()]
        kind = (
            "PRESCRIBER_NPI"
            if "npi" in before.casefold()
            else "CLAIM_NUMBER"
            if _CLAIM_CUE.search(before)
            else "MEMBER_ID"
        )
        out.append(Span(m.start(), m.end(), kind))
    return out


def _trim_title(text: str, s: Span) -> Span:
    m = _TITLE.match(text[s.start : s.end]) if s.kind in NAME_KINDS else None
    return Span(s.start + m.end(), s.end, s.kind) if m and s.start + m.end() < s.end else s


def merge_overlaps(text: str, spans: list[Span]) -> list[Span]:
    """Overlapping spans become their union. A name beats another kind over the same words (a model may read
    "KOWALCZYK" as an ID), but not a longer identifier it sits inside (an email address holding the surname
    stays an email). A prescriber's name beats a patient's (a model's "Dr. Nadia" and regex's "Nadia Ferreira"
    are one prescriber). Otherwise the longest span's kind is kept."""
    out: list[Span] = []
    for s in sorted(spans, key=lambda s: (s.start, -s.end)):
        if out and s.start < out[-1].end:
            last = out[-1]
            longest = max((last, s), key=lambda x: x.end - x.start)
            names = [k for k in NAME_KINDS[::-1] if k in (last.kind, s.kind)]
            inside = (
                longest.kind not in NAME_KINDS
                and (longest.end - longest.start)
                > max(x.end - x.start for x in (last, s) if x.kind in NAME_KINDS)
                if names
                else False
            )
            kind = names[0] if names and not inside else longest.kind
            out[-1] = Span(last.start, max(last.end, s.end), kind)
        else:
            out.append(s)
    return [_trim_title(text, s) for s in out]


def _known_term(text: str, s: Span, vocabulary: Collection[str]) -> bool:
    """A one-word name that is a known clinical or payer word, with no honorific before it: an honorific is a cue
    ("Mrs. Wilson"), whether or not a model kept it in its span (decision 0030)."""
    words = re.findall(r"[A-Za-z][A-Za-z'\-]*", text[s.start : s.end])
    before = re.search(r"([A-Za-z]+)\.?\s+$", text[max(0, s.start - 8) : s.start])
    if before and before.group(1).casefold() in kinship.HONORIFICS:
        return False
    return (
        s.kind in NAME_KINDS
        and len(words) == 1
        and words[0].casefold().removesuffix("'s") in vocabulary
    )


def _caps_first_names(text: str, spans: list[Span]) -> list[Span]:
    out = []
    for s in spans:
        word = text[s.start : s.end]
        m = (
            _CAPS_FIRST.match(text, s.end)
            if s.kind in NAME_KINDS and word.isupper() and " " not in word
            else None
        )
        out.append(Span(s.start, m.end(), s.kind) if m else s)
    return out


def caps_names(text: str, vocabulary: Collection[str]) -> list[Span]:
    """Every all-capitals "LAST, FIRST" in `text` that is not a heading, a city and state, known terms, or
    credentials and ID labels alone ("MD, NPI")."""
    out = []
    for m in _CAPS_NAME.finditer(text):
        words = re.findall(r"[A-Za-z][A-Za-z'\-]*", m.group("name"))
        if not all(w.casefold() in vocabulary or w.casefold() in CREDENTIALS for w in words):
            out.append(Span(m.start("name"), m.end("name"), "PATIENT_NAME"))
    return out


def _given(raw: str) -> str:
    """The first name of a full name: "Pavel" of "Pavel Hill" and of "HILL, PAVEL"; "" for one word."""
    if "," in raw:
        after = raw.split(",", 1)[1].split()
        return after[0] if after else ""
    words = raw.split()
    return words[0] if len(words) > 1 else ""


def _first_names(
    text: str,
    spans: list[Span],
    vocabulary: Collection[str],
    decoded: Collection[tuple[str, str]] = (),
) -> dict[str, str]:
    """{"Pavel": kind, "PAVEL": kind} for each found full name's first name of 3+ letters that is not a known term."""
    out: dict[str, str] = {}
    names = [(text[s.start : s.end], s.kind) for s in spans] + list(decoded)
    for raw, kind in names:
        first = _given(raw) if kind in NAME_KINDS else ""
        if len(first) >= 3 and first.casefold() not in vocabulary:
            for form in (first[:1].upper() + first[1:].lower(), first.upper()):
                out.setdefault(form, kind)
    return out


def every_mention(
    text: str,
    spans: list[Span],
    vocabulary: Collection[str] = frozenset(),
    decoded: Collection[tuple[str, str]] = (),
) -> list[Span]:
    """Spans for every other appearance of each name found, with the kind it was found as; and a full name's first
    name alone, capitalised or in capitals ("Pavel called"), unless it is a clinical or payer word. A first name
    found alone stays case-sensitive on the next pass, so "Will" never brings "I will"."""
    given = _first_names(text, spans, vocabulary, decoded)
    firsts = {g.casefold() for g in given}
    found: dict[str, str] = {}
    names = [(text[s.start : s.end], s.kind) for s in spans] + list(decoded)
    for raw, kind in names:
        if kind in NAME_KINDS and raw.casefold() not in firsts:
            for form in name_forms(raw):
                found.setdefault(form.casefold(), kind)
    return [
        Span(m.start(), m.end(), kind)
        for form, kind in found.items()
        for m in re.finditer(rf"(?<!\w){re.escape(form)}(?!\w)", text, flags=re.IGNORECASE)
    ] + [
        Span(m.start(), m.end(), kind)
        for form, kind in given.items()
        for m in re.finditer(rf"(?<!\w){re.escape(form)}(?!\w)", text)
    ]


def combined_spans(
    text: str,
    cued: list[Span],
    found: list[Span],
    vocabulary: Collection[str] = frozenset(),
    known: known_identity.KnownIdentity | None = None,
) -> tuple[list[Span], list[tuple[str, str]]]:
    """Find identifier spans and retain the values dropped from fixed control positions."""
    if len(text) > MAX_INPUT:
        return [], []
    found = [s for s in found if not _known_term(text, s, vocabulary)]
    known_spans = (known_identity.spans(text, known) if known else []) + fields.read(text)
    spans = merge_overlaps(
        text, cued + known_spans + found + caps_names(text, vocabulary) + long_numbers(text)
    )
    decoded = [(value, s.kind) for s, value in fields.decoded_names(text)]
    spans = merge_overlaps(text, spans + every_mention(text, spans, vocabulary, decoded))
    spans = _caps_first_names(
        text, spans
    )  # after the mentions: "CASTELLANOS" may only be found as "Castellanos"
    spans = merge_overlaps(text, spans + every_mention(text, spans, vocabulary))
    keep = kept(text, known)
    codes = [(m.start(), m.end()) for m in _ICD.finditer(text)]
    # a span holding a known value is never dropped: a plan or group cue next to it must not shield it
    spans = [s for s in spans if _touches(s, known_spans) or not _touches(s, keep)]
    # a format's fixed constant is never an identifier: a span wholly inside one goes (decision 0034, section 13),
    # and the check still searches its value outside control places. A span inside an opaque control value stays,
    # and every whole copy of it in a control place is tokenized with it (review 5, R5-6)
    # only with a case packet that holds the member ID (May, card C7): without one, a member ID written only as a
    # control value would be sent, so nothing is dropped and every such letter is tokenized or held as before
    places = fields.controls(text) if known and known.member_id else []
    inside = [s for s in spans if not _touches(s, known_spans) and _within(s, places)]
    fixed = fields.constants(text) if inside else []
    dropped = [s for s in inside if _within(s, fixed)]
    spans = [s for s in spans if s not in dropped]
    spans += [
        c
        for c in copies(text, [s for s in inside if s not in dropped], places)
        if not _touches(c, spans)
    ]
    # a code is kept only from a span that is the code itself, never by dropping an identifier that contains one
    spans = [
        s
        for s in spans
        if _touches(s, known_spans) or not any(a <= s.start and s.end <= b for a, b in codes)
    ]
    spans = (
        known_facts.shield(text, spans, known.facts, known_spans)
        if known and known.facts
        else spans
    )
    return spans, [(s.kind, text[s.start : s.end]) for s in dropped]


def tokenize_spans(
    text: str,
    detected: tuple[list[Span], list[tuple[str, str]]],
    registry: Registry,
    known: known_identity.KnownIdentity | None = None,
    mapping: dict[str, str] | None = None,
    reserved: Collection[str] = (),
) -> Tokenized:
    """Extend the case token table and hold on a residual identifier."""
    if len(text) > MAX_INPUT:
        return Tokenized("", {}, residual.TOO_LONG)
    spans, dropped = detected
    tokenized = tokenize(
        text, assign_roles(text, spans), prescriber_role(registry), mapping, reserved
    )
    tokenized.residual = residual.check(
        text, tokenized.text, tokenized.mapping, known, dropped=dropped
    )
    return tokenized


def combine(
    text: str,
    cued: list[Span],
    found: list[Span],
    registry: Registry,
    vocabulary: Collection[str] = frozenset(),
    known: known_identity.KnownIdentity | None = None,
    mapping: dict[str, str] | None = None,
    reserved: Collection[str] = (),
) -> Tokenized:
    """Combine the deterministic spans with any caller-supplied spans, then check the output."""
    detected = combined_spans(text, cued, found, vocabulary, known)
    return tokenize_spans(text, detected, registry, known, mapping, reserved)


def _within(s: Span, places: list[tuple[int, int]]) -> bool:
    return any(a <= s.start and s.end <= b for a, b in places)


def _touches(s: Span, ranges: Collection[Span | tuple[int, int]]) -> bool:
    """Whether `s` overlaps any of `ranges` (spans or (start, end) pairs)."""
    return any(
        a < s.end and s.start < b
        for a, b in ((r.start, r.end) if isinstance(r, Span) else r for r in ranges)
    )
