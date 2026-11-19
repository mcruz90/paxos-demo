"""Field-aware reading of structured inputs (decision 0030). Standard library only.

A PII model reads an HL7 message or a FHIR resource (and, from decision 0034, an X12 interchange or an NCPDP
SCRIPT message) as prose and misses what the format states outright: the medical
record number in PID-3, the birth date as YYYYMMDD, a city alone in an address field. These spans come from the
structure instead (fields_hl7.py, fields_fhir.py). They are identifiers by position, so combine.py never drops or
cuts them, and a name read here spreads to the rest of the letter like any found name.

Also here: an iCalendar text's escapes ("MRN 123\\nDOB 1/2/64") hide the words around them from the regex cues,
so the cues read an unescaped copy (RFC 5545: unfolded lines, \\n, \\N, \\, \\; and \\\\ undone) whose offsets map
back to the letter. The models' input is not changed.
"""

import re
from collections.abc import Callable

from security.case_tokens import fields_fhir, fields_hl7, fields_ncpdp, fields_x12
from security.case_tokens.deidentify import detect
from security.case_tokens.fields_fhir import Leaf
from security.case_tokens.tokens import Span

PRESCRIBERS = ("Practitioner", "PractitionerRole")
PRESCRIBER_REFS = ("requester", "performer", "author")
PATIENT_REFS = ("subscriber", "beneficiary", "patient", "subject", "source")
ADDRESS_PARTS = ("line", "city", "district", "postalCode", "text")
SYSTEMS = {"phone": "PHONE", "fax": "PHONE", "sms": "PHONE", "pager": "PHONE", "email": "EMAIL"}
SKIPPED = (
    "Organization",
)  # an organisation's identifiers and contacts are not a person's (the anonymizer keeps them)


def _items(x) -> list:
    return x if isinstance(x, list) else [x]


def _leaves(x) -> list[Leaf]:
    return [i for i in _items(x) if isinstance(i, Leaf)]


def _words(x) -> str:
    """Every string under `x`, joined: an identifier's system and type text."""
    if isinstance(x, Leaf):
        return x.value
    values = x.values() if isinstance(x, dict) else x if isinstance(x, list) else []
    return " ".join(_words(v) for v in values)


def _kind(base: str, prescriber: bool) -> str:
    return (
        f"PRESCRIBER_{base.removeprefix('PATIENT_')}" if prescriber and base != "ADDRESS" else base
    )


def _identifier_kind(node: dict, prescriber: bool) -> str:
    about = _words({k: v for k, v in node.items() if k in ("system", "type")}).casefold()
    if "us-npi" in about or prescriber:
        return "PRESCRIBER_NPI"
    if "us-ssn" in about or re.search(r"\b(?:ssn|ss|social security)\b", about):
        return "SSN"
    return "MRN" if re.search(r"\b(?:mrn?|medical record)\b", about) else "MEMBER_ID"


def _names(leaves: list[Leaf], kind: str) -> list[Span]:
    """Name spans, whole: the field says they are names, so the relation word list never cuts them (a patient named
    Parent). A single letter (a middle initial) is not read."""
    return [Span(x.start, x.end, kind) for x in leaves if len(x.value.strip()) > 1]


def _shape(node: dict, key: str, prescriber: bool) -> list[Span] | None:
    """The spans of one datatype the node's shape names, or None when it is no datatype read here."""
    if "family" in node or "given" in node or (key == "name" and "text" in node):
        parts = [leaf for k in ("family", "given", "text") for leaf in _leaves(node.get(k, []))]
        return _names(parts, _kind("PATIENT_NAME", prescriber))
    if any(k in node for k in ADDRESS_PARTS[:4]):
        return [
            Span(x.start, x.end, "ADDRESS")
            for k in ADDRESS_PARTS
            for x in _leaves(node.get(k, []))
            if x.value
        ]
    system = _leaves(node.get("system", []))
    if system and system[0].value in SYSTEMS and "value" in node:
        kind = _kind(SYSTEMS[system[0].value], prescriber)
        return [Span(x.start, x.end, kind) for x in _leaves(node["value"]) if x.value]
    if key == "identifier" and "value" in node:
        kind = _identifier_kind(node, prescriber)
        return [Span(x.start, x.end, kind) for x in _leaves(node["value"]) if x.value]
    if key in PRESCRIBER_REFS + PATIENT_REFS and "display" in node:
        names = _names(_leaves(node["display"]), _kind("PATIENT_NAME", key in PRESCRIBER_REFS))
        return names + _walk(
            {k: v for k, v in node.items() if k != "display"}, "", key
        )  # its identifier
    return None


def _walk(node, resource: str = "", key: str = "") -> list[Span]:
    if isinstance(node, list):
        return [s for item in node for s in _walk(item, resource, key)]
    if not isinstance(node, dict):
        return []
    rt = _leaves(node.get("resourceType", []))
    resource = rt[0].value if rt else resource
    if resource in SKIPPED:
        return []
    found = _shape(node, key, resource in PRESCRIBERS)
    if found is not None:
        return found
    out = []
    for k, v in node.items():
        if k == "birthDate":
            out += [Span(x.start, x.end, "DOB") for x in _leaves(v)]
        elif k == "subscriberId":
            out += [Span(x.start, x.end, "MEMBER_ID") for x in _leaves(v)]
        else:
            out += _walk(v, resource, k)
    return out


def read(text: str) -> list[Span]:
    """Every identifier the HL7 v2, X12 and NCPDP messages and FHIR resources in `text` state by position."""
    trees = fields_fhir.json_trees(text) + fields_fhir.xml_trees(text)
    found = fields_hl7.spans(text) + fields_x12.spans(text) + fields_ncpdp.spans(text)
    return found + [s for tree in trees for s in _walk(tree)]


_HL7_ESCAPE = re.compile(r"\\(?:([FSTRE])|X((?:[0-9A-Fa-f]{2})+))\\")
_HL7_CHARS = {"F": "|", "S": "^", "T": "&", "R": "~", "E": "\\"}
_XML_NOISE = re.compile(r"<!--.*?-->|<!\[CDATA\[(.*?)\]\]>", re.S)


def hl7_value(raw: str) -> str:
    """Decode HL7 v2 escapes once: the delimiter escapes and hexadecimal characters (a backslash, "X66", a backslash
    is "f"). Any other escape (highlighting, a local code) is left as it is."""

    def one(m: re.Match[str]) -> str:
        return _HL7_CHARS[m.group(1)] if m.group(1) else bytes.fromhex(m.group(2)).decode("latin-1")

    return _HL7_ESCAPE.sub(one, raw)


def ncpdp_value(raw: str) -> str:
    """An NCPDP element's text as a reader sees it: comments dropped, CDATA sections opened (their text is literal),
    character references decoded once outside them."""
    parts, at = [], 0
    for m in _XML_NOISE.finditer(raw):
        parts += [fields_fhir.xml_value(raw[at : m.start()]), m.group(1) or ""]
        at = m.end()
    return "".join(parts) + fields_fhir.xml_value(raw[at:])


def decoded(text: str) -> list[tuple[Span, str]]:
    """Encoded spans of every kind (names, identifiers, contacts) paired with their decoded value: FHIR XML and NCPDP
    character references, NCPDP comments and CDATA, FHIR JSON escapes, HL7 v2 escapes. Spans keep raw offsets, so
    replacement and rehydration still use the raw text (#172, R5-1)."""
    xml, as_json = fields_fhir.xml_value, fields_fhir.json_value
    pairs = [(s, xml) for tree in fields_fhir.xml_trees(text) for s in _walk(tree)]
    pairs += [(s, as_json) for tree in fields_fhir.json_trees(text) for s in _walk(tree)]
    pairs += [(s, ncpdp_value) for s in fields_ncpdp.spans(text)] + [
        (s, hl7_value) for s in fields_hl7.spans(text)
    ]
    return [
        (s, value)
        for s, decode in pairs
        if (value := decode(text[s.start : s.end])) != text[s.start : s.end]
    ]


def decoded_names(text: str) -> list[tuple[Span, str]]:
    """Encoded name spans (FHIR XML or JSON, NCPDP) paired with their decoded value; spans keep raw offsets."""
    return [
        (s, value) for s, value in decoded(text) if s.kind in ("PATIENT_NAME", "PRESCRIBER_NAME")
    ]


def _class_facts(node, key: str = "") -> list[tuple[int, int]]:
    """A FHIR coverage class of type plan or group: its value is a case fact."""
    if isinstance(node, list):
        return [r for item in node for r in _class_facts(item, key)]
    if not isinstance(node, dict):
        return []
    if key == "class" and re.search(r"\b(?:plan|group)\b", _words(node.get("type", [])).casefold()):
        return [(x.start, x.end) for x in _leaves(node.get("value", [])) if x.value]
    return [r for k, v in node.items() for r in _class_facts(v, k)]


def facts(text: str) -> list[tuple[int, int]]:
    """Where a format states a plan or group number by position (decision 0034): HL7 IN1-2 and IN1-8, X12 REF 6P,
    1L, 18 and N6, NCPDP GroupID, PCN and BIN, a FHIR coverage class of type plan or group. combine protects them."""
    trees = fields_fhir.json_trees(text) + fields_fhir.xml_trees(text)
    found = fields_hl7.facts(text) + fields_x12.facts(text) + fields_ncpdp.facts(text)
    return found + [r for tree in trees for r in _class_facts(tree)]


def controls(text: str) -> list[tuple[int, int]]:
    """Where a format states its own control values by position (decision 0034, section 13): X12 envelope values,
    the NCPDP root's versions, HL7 MSH values and phone codes. The output check still reads them."""
    return fields_x12.controls(text) + fields_ncpdp.controls(text) + fields_hl7.controls(text)


def constants(text: str) -> list[tuple[int, int]]:
    """The control places that are fixed constants of their format (a segment ID, a code, a release in the
    standard's list): combine drops a span wholly inside one. Any other control place is opaque (a control number,
    a sender ID, a date): its shape fits an identifier, so combine tokenizes a span there (review 5, R5-6)."""
    return (
        fields_x12.controls(text, True)
        + fields_ncpdp.controls(text, True)
        + fields_hl7.controls(text, True)
    )


_ICAL_ESCAPE = re.compile(r"\r?\n[ \t]|\\[nN,;\\]")


def unescaped(text: str) -> tuple[str, list[int]]:
    """An iCalendar text unfolded and unescaped, and for each of its positions (and its end) the letter's."""
    out: list[str] = []
    back: list[int] = []
    pos = 0
    for m in _ICAL_ESCAPE.finditer(text):
        out.append(text[pos : m.start()])
        back += range(pos, m.start())
        if m.group()[0] == "\\":
            out.append("\n" if m.group()[1] in "nN" else m.group()[1])
            back.append(m.start())
        pos = m.end()
    out.append(text[pos:])
    back += range(pos, len(text) + 1)
    return "".join(out), back


def cued(text: str, keep_salutation: Callable[[int, int], bool] | None = None) -> list[Span]:
    """The regex cues' spans: on an unescaped copy of an iCalendar text, mapped back to the letter.
    `keep_salutation` filters the salutation cue's names by their offsets in `text` (decision 0035)."""
    if "BEGIN:VCALENDAR" not in text:
        return detect(text, keep_salutation)
    copy, back = unescaped(text)
    keep = (
        None if keep_salutation is None else lambda a, b: keep_salutation(back[a], back[b - 1] + 1)
    )
    return [Span(back[s.start], back[s.end - 1] + 1, s.kind) for s in detect(copy, keep)]
