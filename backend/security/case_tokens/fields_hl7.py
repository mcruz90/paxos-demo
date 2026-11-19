"""Identifiers read by their position in an HL7 v2 message (decision 0030). Standard library only.

In the style of the IHE de-identification handbook: field by field, every field HL7 defines as a person's name,
identifier, address, phone or birth date in PID, NK1, PV1, ORC, OBR and IN1. The plan and group (IN1-2, IN1-8), the
payer (IN1-4), orders, diagnoses and notes are not read: they are case facts or free text, left to the models.

A message starts at a line beginning "MSH"; its delimiters are read from MSH-1 and MSH-2, not assumed. It runs
until a line that is not a segment. Every span covers a component's own text in the letter; HL7 escapes stay inside it.

Decision 0034 adds: segments may end in a carriage return alone, as interfaces send them; segments pasted with no
MSH (a ticket, a log's "> PID|...") are read with the default delimiters when that is unambiguous (_bare); and the
plan and group (IN1-2, IN1-8) are returned by facts() for combine to protect. Section 13 adds controls(): the
MSH's message type, processing ID and version, and a phone field's use and equipment codes.
"""

import re
from collections.abc import Iterator

from security.case_tokens.places import runs, shaped
from security.case_tokens.tokens import Span

_NAME = (1, 2, 3)  # family, given, middle; the suffix, prefix and degree stay
_ADDRESS = (
    1,
    2,
    3,
    5,
    9,
)  # street, other designation, city, ZIP, county; the state and country stay
_XCN = {1: "PRESCRIBER_NPI", 2: "PRESCRIBER_NAME", 3: "PRESCRIBER_NAME", 4: "PRESCRIBER_NAME"}
_PERSON = {
    "name": ("PATIENT_NAME", _NAME),
    "dob": ("DOB", (1,)),
    "address": ("ADDRESS", _ADDRESS),
    "phone": ("PHONE", None),
    "account": ("ACCOUNT_NUMBER", (1,)),
    "ssn": ("SSN", (1,)),
    "id": ("MEMBER_ID", (1,)),
}
# segment -> {field: what it holds}; "ids" is PID-3, typed by its component 5, "doctor" an XCN
FIELDS = {
    "PID": {
        3: "ids",
        5: "name",
        6: "name",
        7: "dob",
        9: "name",
        11: "address",
        13: "phone",
        14: "phone",
    }
    | {18: "account", 19: "ssn", 20: "id"},
    "NK1": {2: "name", 4: "address", 5: "phone", 6: "phone"},
    "ORC": {12: "doctor"},
    "OBR": {16: "doctor"},
    "PV1": {7: "doctor", 8: "doctor", 9: "doctor", 17: "doctor"},
    "IN1": {16: "name", 18: "dob", 19: "address", 36: "id", 49: "id"},
}
ID_TYPES = {"MR": "MRN", "SS": "SSN", "AN": "ACCOUNT_NUMBER"}  # any other type code is a member ID
_MSH = re.compile(r"(?<![^\r\n])MSH(?P<f>[^\w\s])(?P<enc>[^\w\s]{2,4})")  # at the start of a line
_LINE = re.compile(r"([^\r\n]*)(\r\n|\r|\n|$)")
_BARE = re.compile(r"[ \t]*(?:>[ \t]*)?(?=(?:PID|NK1|IN1|PV1|ORC|OBR)\|)")
DEFAULT = ("|", "^", "~")  # the field, component and repetition separators HL7 defaults to
FACT_FIELDS = {"IN1": (2, 8)}  # the plan and the group
Delims = tuple[str, str, str]
_SEGMENT = r"[A-Z][A-Z0-9]{2}"
# MSH-n is piece n - 1 of the line split at the field separator; "{c}" is the component separator
MSH_CONTROLS = {
    8: r"[A-Z0-9]{3}(?:{c}[A-Z0-9]{3}(?:{c}[A-Z0-9_]{3,7})?)?",  # MSH-9, the message type ("RDE^O11^RDE_O11")
    10: r"[PTD]",  # MSH-11, the processing ID
    11: r"\d\.\d{1,2}(?:\.\d{1,2})?",  # MSH-12, the version
}
# the message types of HL7 table 0076 a letter is likely to quote: only these make MSH-9 a fixed constant
MSH_TYPES = (
    "ACK|ADT|BAR|DFT|MDM|MFN|OML|OMP|ORM|ORU|PPR|QBP|QRY|RAS|RDE|RDS|REF|RGV|RRE|RSP|SIU|VXU"
)
_MSH9 = rf"(?:{MSH_TYPES})(?:{{c}}[A-Z]\d{{2}}(?:{{c}}(?:{MSH_TYPES})(?:_[A-Z]\d{{2}})?)?)?"
MSH_CONSTANTS = MSH_CONTROLS | {8: _MSH9}
XTN_CODES = {
    1: r"PRN|ORN|WPN|VHN|ASN|EMR|NET|BPN|PRS",
    2: r"PH|FX|MD|CP|SAT|BP|Internet|X\.400|TDD|TTY",
}


def _split(value: str, start: int, sep: str) -> list[tuple[str, int]]:
    """`value` split at `sep`, each piece with its offset in the letter."""
    out, pos = [], start
    for piece in value.split(sep):
        out.append((piece, pos))
        pos += len(piece) + len(sep)
    return out


def _component_spans(comps: list[tuple[str, int]], wanted, kind: str) -> list[Span]:
    """The wanted components (numbered from 1) as spans; `wanted` None (a phone field) takes every component
    holding a digit or an email address."""
    out = []
    for n, (value, at) in enumerate(comps, 1):
        contact = wanted is None and any(c.isdigit() or c == "@" for c in value)
        if value.strip() and (contact or (wanted and n in wanted)):
            if kind != "PATIENT_NAME" or len(value.strip()) > 1:  # a middle initial is not read
                out.append(Span(at, at + len(value), "EMAIL" if contact and "@" in value else kind))
    return out


def _field_spans(what: str, comps: list[tuple[str, int]]) -> list[Span]:
    if what == "ids":
        kind = ID_TYPES.get(comps[4][0], "MEMBER_ID") if len(comps) > 4 else "MEMBER_ID"
        return _component_spans(comps[:1], (1,), kind)
    if what == "doctor":
        return [
            s
            for n, kind in _XCN.items()
            for s in _component_spans(comps[n - 1 : n], (1,), kind)
            if n <= len(comps)
        ]
    kind, wanted = _PERSON[what]
    return _component_spans(comps, wanted, kind)


def _segment_spans(line: str, at: int, delims: tuple[str, str, str]) -> list[Span]:
    field_sep, comp_sep, rep_sep = delims
    fields = _split(line, at, field_sep)
    rules = FIELDS.get(fields[0][0], {})
    out = []
    for number, what in rules.items():
        if number < len(fields):
            for rep, rep_at in _split(*fields[number], rep_sep):
                out += _field_spans(what, _split(rep, rep_at, comp_sep))
    return out


def _lines(text: str, start: int) -> Iterator[tuple[str, int]]:
    """Each line from `start`, with its offset; a line ends at a carriage return, a line feed or both."""
    for m in _LINE.finditer(text, start):
        yield m.group(1), m.start()
        if not m.group(2):
            return


def _messages(text: str) -> Iterator[tuple[str, int, Delims]]:
    """Every segment of every message from an MSH, with the delimiters that MSH gives."""
    for m in _MSH.finditer(text):
        field_sep, enc = m.group("f"), m.group("enc")
        segment = re.compile(rf"{_SEGMENT}{re.escape(field_sep)}")
        lines = _lines(text, m.start())
        next(lines)  # the MSH itself: no identifiers
        for line, at in lines:
            if not segment.match(line):
                break
            yield line, at, (field_sep, enc[0], enc[1])


def _bare(text: str) -> Iterator[tuple[str, int, Delims]]:
    """Segments pasted with no MSH (decision 0034): runs of PID, NK1, IN1, PV1, ORC and OBR lines, each perhaps after
    one ">" quote mark, read with the default delimiters when the run holds a PID with four "|" and a "^"."""
    run: list[tuple[str, int]] = []
    for line, at in [*_lines(text, 0), ("", -1)]:
        m = _BARE.match(line)
        if m:
            run.append((line[m.end() :], at + m.end()))
            continue
        pids = [seg for seg, _ in run if seg.startswith("PID|")]
        if pids and pids[0].count("|") >= 4 and "^" in pids[0]:
            yield from ((seg, seg_at, DEFAULT) for seg, seg_at in run)
        run = []


def segments(text: str) -> Iterator[tuple[str, int, Delims]]:
    """Every segment read: those of each message, and pasted ones before the first MSH (after it, an MSH gives its
    own delimiters, so a pasted segment is not assumed to use the defaults)."""
    yield from _messages(text)
    first = _MSH.search(text)
    yield from _bare(text[: first.start() if first else len(text)])


def spans(text: str) -> list[Span]:
    """Every identifier in the HL7 v2 messages and pasted segments in `text`, typed by its field."""
    return [s for line, at, delims in segments(text) for s in _segment_spans(line, at, delims)]


def facts(text: str) -> list[tuple[int, int]]:
    """Where the segments state a plan or group number (IN1-2, IN1-8): case facts, never identifiers."""
    out = []
    for line, at, (field_sep, comp_sep, rep_sep) in segments(text):
        fields = _split(line, at, field_sep)
        for n in FACT_FIELDS.get(fields[0][0], ()):
            for rep, rep_at in _split(*fields[n], rep_sep) if n < len(fields) else []:
                value, value_at = _split(rep, rep_at, comp_sep)[0]
                out += [(value_at, value_at + len(value))] if value.strip() else []
    return out


def _msh_controls(text: str, shapes: dict[int, str]) -> list[tuple[int, int]]:
    out = []
    for m in _MSH.finditer(text):
        line, at = next(_lines(text, m.start()))
        pieces = _split(line, at, m.group("f"))
        comp = re.escape(m.group("enc")[0])
        out += runs(
            pieces, shaped(pieces, {n: shape.replace("{c}", comp) for n, shape in shapes.items()})
        )
    return out


def controls(text: str, constant: bool = False) -> list[tuple[int, int]]:
    """Where the messages state their own control values (decision 0034, section 13): MSH-9, MSH-11 and MSH-12 by
    shape (not MSH-7: EVN-2 may repeat the time, and a model may tokenize one copy), and in every phone field a use
    and equipment code from HL7's tables ("^PRN^CP^"). With `constant`, only the fixed ones: an MSH-9 whose message
    type is not in MSH_TYPES is opaque. combine drops a span inside a constant and tokenizes an opaque one."""
    out = _msh_controls(text, MSH_CONSTANTS if constant else MSH_CONTROLS)
    for line, at, (field_sep, comp_sep, rep_sep) in segments(text):
        fields = _split(line, at, field_sep)
        phones = [
            n
            for n, what in FIELDS.get(fields[0][0], {}).items()
            if what == "phone" and n < len(fields)
        ]
        for n in phones:
            for rep, rep_at in _split(*fields[n], rep_sep):
                comps = _split(rep, rep_at, comp_sep)
                out += runs(comps, shaped(comps, XTN_CODES))
    return out
