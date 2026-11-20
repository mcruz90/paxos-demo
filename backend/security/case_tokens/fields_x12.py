"""Identifiers read by their position in an X12 interchange (decision 0034). Standard library only.

Like fields_hl7.py, element by element: every NM1 starts a party, typed by its entity code (IL subscriber and QC
patient: patient kinds; 1P, DK and FA when a person: prescriber kinds); the N3, N4, DMG, PER and REF after it belong
to it until the next NM1 or HL. The payer, organisations, diagnoses, messages and benefits are not read: they are
case facts or free text, left to the models. A plan or group number (REF 6P, 1L, 18, N6) is a fact, returned by
facts() for combine to protect. A transaction's reference numbers (BHT03, TRN02) are read as identifiers, so every
copy of one is tokenized alike; the envelope's own values are controls() (decision 0034, section 13).

An interchange starts at "ISA". Its separators are read from the ISA, which is 106 characters: the element separator
follows "ISA", ISA16 (offset 104) is the component separator and offset 105 the segment terminator. An ISA whose
elements do not have their fixed widths is not read, nor are segments quoted with no ISA: their separators are
unknown. Reading stops at IEA, at a segment whose ID is not 2 or 3 capitals and digits, or after MAX_SEGMENTS.
"""

import re
from collections.abc import Iterator

from security.case_tokens.places import runs, shaped
from security.case_tokens.tokens import Span

WIDTHS = (2, 10, 2, 10, 2, 15, 2, 15, 6, 4, 1, 5, 9, 1, 1, 1)
MAX_SEGMENTS = 5000
PATIENT_PARTIES = ("IL", "QC")
PRESCRIBER_PARTIES = ("1P", "DK", "FA")
NM1_IDS = {"MI": "MEMBER_ID", "II": "MEMBER_ID", "34": "SSN", "XX": "PRESCRIBER_NPI"}
PER_KINDS = dict.fromkeys(("TE", "CP", "HP", "WP", "FX", "BN"), "PHONE") | {"EM": "EMAIL"}
REF_KINDS = {"SY": "SSN", "EJ": "ACCOUNT_NUMBER", "EA": "MRN"} | dict.fromkeys(
    ("1W", "HJ", "NQ", "F6", "IG"), "MEMBER_ID"
)
PLAN_REFS = ("6P", "1L", "18", "N6")
TRACE = {
    "BHT": 3,
    "TRN": 2,
}  # a transaction's reference number: no kind of its own, so an account number
_SENDER = r"(?!.*\d{9})[A-Za-z0-9 ]{1,15}"  # a sender or receiver ID, never with nine digits (an NPI or a tax ID)
_VERSION = r"\d{6}(?:X\d{3}(?:A\d)?)?"
_CODE = r"[A-Z0-9]{2}"
# segment -> {element: its shape}; the segment ID (0) is a control wherever its segment is
CONTROLS = {
    "ISA": {
        5: _CODE,
        6: _SENDER,
        7: _CODE,
        8: _SENDER,
        9: r"\d{6}",
        10: r"\d{4}",
        11: r"\S",
        12: r"\d{5}",
    }
    | {13: r"\d{9}", 14: r"[01]", 15: r"[PT]", 16: r"\S"},
    "GS": {
        1: r"[A-Z]{2}",
        2: _SENDER,
        3: _SENDER,
        4: r"\d{8}",
        5: r"\d{4,8}",
        6: r"\d{1,9}",
        7: r"[TX]",
        8: _VERSION,
    },
    "ST": {1: r"\d{3}", 2: r"\d{4,9}", 3: _VERSION},
    "BHT": {1: r"\d{4}", 2: r"\d{2}", 4: r"\d{8}", 5: r"\d{4,8}", 6: _CODE},
    "SE": {1: r"\d{1,10}", 2: r"\d{4,9}"},
    "GE": {1: r"\d{1,6}", 2: r"\d{1,9}"},
    "IEA": {1: r"\d{1,5}", 2: r"\d{9}"},
}
_RELEASE = (
    r"00[2-8]0\d\d(?:X\d{3}(?:A\d)?)?"  # a release and its implementation guide ("005010X279A1")
)
# the controls that are fixed constants of the standard (codes, separators, releases): never the opaque ones (a
# sender ID, a date, a time, a control number, a count), which an identifier's shape fits
CONSTANTS = {
    "ISA": {5: _CODE, 7: _CODE, 11: r"\S", 12: r"00[2-8]0\d", 14: r"[01]", 15: r"[PT]", 16: r"\S"},
    "GS": {1: r"[A-Z]{2}", 7: r"[TX]", 8: _RELEASE},
    "ST": {1: r"\d{3}", 3: _RELEASE},
    "BHT": {1: r"\d{4}", 2: r"\d{2}", 6: _CODE},
}
PAYERS = ("PR", "X3")  # the payer and, in a 278, the utilization management organisation
PAYER_IDS = ("PI", "XV")  # their ID qualifiers: the payer's own ID
_PAYER_ID = re.compile(
    r"[A-Z0-9][A-Z0-9-]{1,29}"
)  # a payer code ("PAYERLINK", "PLAN-3051"), no spaces or commas
_ISA = re.compile(r"ISA([^\w\s])")
_ID = re.compile(r"[A-Z][A-Z0-9]{1,2}$")

Element = tuple[str, int]  # an element's text and its offset in the letter


def envelope(text: str, at: int) -> tuple[str, str] | None:
    """The element separator and segment terminator of the ISA at `at`, or None when it is not well formed."""
    isa = text[at : at + 106]
    if len(isa) < 106 or isa[105].isalnum() or isa[105].isspace():
        return None
    sep, elements = isa[3], isa[4:105].split(isa[3])
    if len(elements) != len(WIDTHS) or any(
        len(e) != w for e, w in zip(elements, WIDTHS, strict=True)
    ):
        return None
    return sep, isa[105]


def segments(text: str) -> Iterator[list[Element]]:
    """Every segment after each interchange's ISA, split into elements with their offsets."""
    for m in _ISA.finditer(text):
        found = envelope(text, m.start())
        if found is None:
            continue
        sep, term = found
        pos = m.start() + 106
        for _ in range(MAX_SEGMENTS):
            end = text.find(term, pos)
            stop = len(text) if end < 0 else end
            while pos < stop and text[pos].isspace():  # a line break after the terminator
                pos += 1
            elements, at = [], pos
            for piece in text[pos:stop].split(sep):
                elements.append((piece, at))
                at += len(piece) + len(sep)
            if not _ID.match(elements[0][0]):
                break
            yield elements
            if elements[0][0] == "IEA" or end < 0:
                break
            pos = end + len(term)


def _get(els: list[Element], n: int) -> Element:
    return els[n] if n < len(els) else ("", 0)


def _span(el: Element, kind: str, min_len: int = 1) -> list[Span]:
    value, at = el
    return [Span(at, at + len(value), kind)] if len(value.strip()) >= min_len else []


def _nm1(els: list[Element]) -> tuple[str | None, list[Span]]:
    """The party an NM1 starts ("patient", "prescriber" or None) and its spans."""
    code, person = _get(els, 1)[0], _get(els, 2)[0] == "1"
    party = (
        "patient"
        if code in PATIENT_PARTIES
        else "prescriber"
        if code in PRESCRIBER_PARTIES and person
        else None
    )
    if party is None:
        return None, []
    kind = "PATIENT_NAME" if party == "patient" else "PRESCRIBER_NAME"
    out = _span(_get(els, 3), kind) + _span(_get(els, 4), kind) + _span(_get(els, 5), kind, 2)
    id_kind = NM1_IDS.get(_get(els, 8)[0])
    if id_kind and (party == "prescriber") == (id_kind == "PRESCRIBER_NPI"):
        out += _span(_get(els, 9), id_kind)
    return party, out


def _per(els: list[Element], party: str) -> list[Span]:
    prefix = "PRESCRIBER_" if party == "prescriber" else ""
    out = _span(_get(els, 2), "PRESCRIBER_NAME" if prefix else "PATIENT_NAME")
    for n in (3, 5, 7):
        kind = PER_KINDS.get(_get(els, n)[0])
        out += _span(_get(els, n + 1), prefix + kind) if kind else []
    return out


def _party_spans(els: list[Element], party: str) -> list[Span]:
    seg = els[0][0]
    if seg == "PER":
        return _per(els, party)
    if party != "patient":
        return []
    if seg == "N3":
        return _span(_get(els, 1), "ADDRESS") + _span(_get(els, 2), "ADDRESS")
    if seg == "N4":
        return _span(_get(els, 1), "ADDRESS") + _span(_get(els, 3), "ADDRESS")
    if seg == "DMG" and _get(els, 1)[0] == "D8":
        return _span(_get(els, 2), "DOB")
    kind = REF_KINDS.get(_get(els, 1)[0]) if seg == "REF" else None
    return _span(_get(els, 2), kind) if kind else []


def spans(text: str) -> list[Span]:
    """Every identifier the X12 interchanges in `text` state by position, typed by their party."""
    out: list[Span] = []
    party: str | None = None
    for els in segments(text):
        seg = els[0][0]
        if seg in TRACE:
            out += _span(_get(els, TRACE[seg]), "ACCOUNT_NUMBER")
        elif seg in ("HL", "ISA", "IEA"):
            party = None
        elif seg == "NM1":
            party, found = _nm1(els)
            out += found
        elif party:
            out += _party_spans(els, party)
    return out


def facts(text: str) -> list[tuple[int, int]]:
    """Where the interchanges state a plan or group number (REF 6P, 1L, 18, N6): case facts, never identifiers."""
    return [
        (at, at + len(value))
        for els in segments(text)
        if els[0][0] == "REF" and _get(els, 1)[0] in PLAN_REFS
        for value, at in [_get(els, 2)]
        if value.strip()
    ]


def _isa(text: str, at: int) -> list[Element]:
    """The ISA at `at` (well formed) as its ID and sixteen elements, with their offsets."""
    out, pos = [("ISA", at)], at + 4
    for width in WIDTHS:
        out.append((text[pos : pos + width], pos))
        pos += width + 1
    return out


def _envelopes(text: str) -> Iterator[list[Element]]:
    for m in _ISA.finditer(text):
        if envelope(text, m.start()):
            yield _isa(text, m.start())
    yield from segments(text)


def _with_terminator(text: str, els: list[Element], place: tuple[int, int]) -> tuple[int, int]:
    """A place ending with its segment, with the terminator after it: a span over "000055122~" lies inside."""
    start, end = place
    last, at = els[-1]
    ends = (
        end == at + len(last)
        and end < len(text)
        and not (text[end].isalnum() or text[end].isspace())
    )
    return (start, end + 1) if ends else place


def controls(text: str, constant: bool = False) -> list[tuple[int, int]]:
    """Where the interchanges state their own control values by position and shape (decision 0034, section 13):
    sender and receiver IDs, dates and times, control numbers, versions and codes of ISA, GS, ST, BHT, SE, GE and
    IEA, each run with its segment ID, every other segment's ID ("HI", "N3"), and the payer's NM1 ID. With
    `constant`, only the fixed ones (CONSTANTS and segment IDs). combine drops a span inside a constant and
    tokenizes an opaque one."""
    out = []
    shapes = CONSTANTS if constant else CONTROLS
    for els in _envelopes(text):
        seg = els[0][0]
        out += [
            _with_terminator(text, els, place)
            for place in runs(els, {0} | shaped(els, shapes.get(seg, {})))
        ]
        if constant:
            continue
        if seg == "NM1" and _get(els, 1)[0] in PAYERS and _get(els, 8)[0] in PAYER_IDS:
            out += [(at, at + len(v)) for v, at in [_get(els, 9)] if _PAYER_ID.fullmatch(v)]
    return out
