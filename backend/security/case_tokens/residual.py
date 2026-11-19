"""The output check before anything is sent (decision 0034, section 1). Standard library only.

After combine has tokenized a letter, every identifier the pipeline has seen is looked for again in the output, in
every written form residual_forms.py knows:

    mapping   every value the pipeline tokenized
    field     every identifier the field readers find in the input (fields.read: HL7, FHIR, X12, NCPDP)
              and, for an encoded FHIR XML value, its decoded form too (fields.decoded)
    packet    the case's known identity: the patient's name, birth date, member ID and address; each prescriber's
              name, NPI and phone
    dropped   every value combine dropped from inside a format's control place (section 13): searched everywhere
              but control places, so a copy in the free text still holds the case

If any is still readable, the case is held for a person and never sent. Both sides are folded first: normalised
(deidentify.normalise) and with every apostrophe as "'". A hit inside a place the appeal needs (a plan or group ID,
a known fact, stated by position or by the case packet) or inside a token the pipeline issued is ignored; one
protected only by a cue word is not.

The verdict names kinds and sources only, never a value, an offset or context, so it is safe to log and show.
The check never raises: an error inside it holds the case as CHECK_ERROR, and more than MAX_VALUES values hold it
as TOO_MANY_VALUES, and a source or output over deidentify.MAX_INPUT characters as TOO_LONG (R5-5). It does not
read the clinical vocabulary: holding a letter by mistake is the safe error.
"""

import re
import time
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass

from security.case_tokens import fields, known_facts, known_identity
from security.case_tokens.deidentify import MAX_INPUT, normalise
from security.case_tokens.known_identity import KnownIdentity
from security.case_tokens.places import in_output
from security.case_tokens.residual_forms import could_match, forms
from security.case_tokens.tokens import PATIENT_KINDS, PRESCRIBER_KINDS, TOKEN

MAX_VALUES = 500
MAX_LENGTH = 200
_APOSTROPHES = str.maketrans(
    dict.fromkeys(map(chr, (0x2019, 0x2018, 0x02BC, 0x02BB, 0x60, 0xB4)), "'")
)
_TAG_NAME = re.compile(r"</?([A-Za-z_][\w.-]*)(?=[\s/>])")
_CLOSING = re.compile(r"</([A-Za-z_][\w.-]*)\s*>")
_BY_SUFFIX = {suffix: kind for kind, suffix in PRESCRIBER_KINDS.items()}

Value = tuple[str, str, str]  # kind, text, source
Protect = Callable[[str], list[tuple[int, int]]]


@dataclass(frozen=True)
class Residual:
    held: bool = False
    kinds: tuple[str, ...] = ()
    sources: tuple[str, ...] = ()
    hits: int = 0
    ms: float = 0.0  # the check's own time

    def as_dict(self) -> dict:
        """The verdict as the eval records it: kinds, sources and a count, never a value."""
        return {
            k: list(v) if isinstance(v, tuple) else v for k, v in asdict(self).items() if k != "ms"
        }


TOO_LONG = Residual(True, ("TOO_LONG",), (), 1)


def fold(text: str) -> str:
    return normalise(text).translate(_APOSTROPHES)


def token_kind(token: str) -> str | None:
    """The identifier kind of a mapping token: {{MRN_2}} is MRN, {{ENDOCRINOLOGIST_PHONE_1}} PRESCRIBER_PHONE."""
    name = token.strip("{}").rsplit("_", 1)[0]
    if name in PATIENT_KINDS:
        return name
    return _BY_SUFFIX.get(name.rsplit("_", 1)[-1])


def _packet(known: KnownIdentity) -> list[Value]:
    out = [
        ("PATIENT_NAME", f"{known.given} {known.family}", "packet"),
        ("DOB", known.dob, "packet"),
    ]
    out += [("MEMBER_ID", known.member_id, "packet"), ("ADDRESS", known.address, "packet")]
    for p in known.prescribers:
        out += [
            ("PRESCRIBER_NAME", f"{p.given} {p.family}", "packet"),
            ("PRESCRIBER_NPI", p.npi, "packet"),
        ]
        out += [("PRESCRIBER_PHONE", p.phone, "packet")]
    return out


def values(
    source: str,
    mapping: dict[str, str],
    known: KnownIdentity | None,
    dropped: Sequence[tuple[str, str]] = (),
) -> list[Value]:
    """Every value to look for, with its kind and source; empty values dropped, long ones cut."""
    out = [(kind, v, "mapping") for t, v in mapping.items() if (kind := token_kind(t))]
    out += [(kind, v, "dropped") for kind, v in dropped]
    out += [(s.kind, source[s.start : s.end], "field") for s in fields.read(source)]
    out += [(s.kind, value, "field") for s, value in fields.decoded(source)]
    out += _packet(known) if known else []
    return [(k, v[:MAX_LENGTH], src) for k, v, src in out if v and v.strip()]


def _authoritative(text: str, known: KnownIdentity | None) -> list[tuple[int, int]]:
    """Plan and group numbers a format states by position, and the case's known plan IDs. A place protected only by a
    cue word ("plan", "group", a toll-free number) is not: a cue can sit before any number (security review, 0034)."""
    return fields.facts(text) + (known_identity.protected(text, known) if known else [])


def _markup(text: str) -> list[tuple[int, int]]:
    """Tag names of elements the output also closes (security review, section 8): "<Rosswell>" with no
    "</Rosswell>" is text, not markup."""
    closed = set(_CLOSING.findall(text))
    return [(m.start(), m.end()) for m in _TAG_NAME.finditer(text) if m.group(1) in closed]


def _ignored(
    text: str, known: KnownIdentity | None, keep: Protect, mapping: dict[str, str]
) -> list[tuple[int, int]]:
    # only tokens the pipeline issued: a token-shaped string it did not issue is not a token (security review, 0034)
    places = keep(text) + [
        (m.start(), m.end()) for m in TOKEN.finditer(text) if m.group() in mapping
    ]
    places += _markup(text)  # markup, not text ("<LastName>": section 8)
    return places + (known_facts.ranges(text, known.facts) if known and known.facts else [])


def _hits(
    text: str, found: list[Value], ignored: list[tuple[int, int]], controls: list[tuple[int, int]]
) -> set[tuple[str, str, int, int]]:
    """Every readable place of every value; a value only dropped (no other source) is also ignored in `controls`."""
    by_value: dict[tuple[str, str], set[str]] = {}
    for kind, value, src in found:  # each value is searched once, whatever its sources
        by_value.setdefault((kind, fold(value)), set()).add(src)
    lower, out = text.casefold(), set()
    skeleton = re.sub(r"[^A-Za-z0-9]", "", text).casefold()
    for (kind, value), sources in by_value.items():
        pattern = forms(kind, value) if could_match(kind, value, lower, skeleton) else None
        places = ignored + controls if sources == {"dropped"} else ignored
        for m in pattern.finditer(text) if pattern else ():
            if not any(a <= m.start() and m.end() <= b for a, b in places):
                out |= {(kind, src, m.start(), m.end()) for src in sources}
    return out


def _controls(
    output: str, text: str, mapping: dict[str, str], controls: list[tuple[int, int]]
) -> list[tuple[int, int]]:
    """The source's control places in the folded output; none unless folding kept every character in place (the
    safe error): one character folded to one, the same as folding the whole, so no offset moved."""
    return in_output(controls, output, mapping) if _in_place(output, text) else []


def _in_place(output: str, text: str) -> bool:
    if output.isascii():  # folding ASCII changes only "`" to "'"
        return len(text) == len(output)
    chars = [fold(c) for c in output]
    return all(len(c) == 1 for c in chars) and "".join(chars) == text


def _search(
    source: str,
    output: str,
    mapping: dict[str, str],
    known: KnownIdentity | None,
    keep: Protect | None,
    dropped: Sequence[tuple[str, str]],
) -> set[tuple[str, str, int, int]] | None:
    """Every hit in the folded output; None when the case is too large to search."""
    if max(len(source), len(output)) > MAX_INPUT:  # held whole, never cut (R5-5)
        return None
    found = values(source, mapping, known, dropped)
    if len(found) > MAX_VALUES:
        return None
    text = fold(output)
    ignored = _ignored(text, known, keep or (lambda t: _authoritative(t, known)), mapping)
    controls = _controls(output, text, mapping, fields.controls(source)) if dropped else []
    return _hits(text, found, ignored, controls)


def _verdict(
    source: str,
    output: str,
    mapping: dict[str, str],
    known: KnownIdentity | None,
    keep: Protect | None,
    dropped: Sequence[tuple[str, str]],
) -> Residual:
    if max(len(source), len(output)) > MAX_INPUT:
        return TOO_LONG
    hits = _search(source, output, mapping, known, keep, dropped)
    if hits is None:
        return Residual(True, ("TOO_MANY_VALUES",), (), 1)
    # one place found from two sources counts once
    places = {(k, a, b) for k, _, a, b in hits}
    return Residual(
        bool(hits),
        tuple(sorted({h[0] for h in hits})),
        tuple(sorted({h[1] for h in hits})),
        len(places),
    )


def check(
    source: str,
    output: str,
    mapping: dict[str, str],
    known: KnownIdentity | None = None,
    keep: Protect | None = None,
    dropped: Sequence[tuple[str, str]] = (),
) -> Residual:
    """Whether `output` (the tokenized text of `source`, with `mapping`) still shows an identifier the pipeline has
    seen. `keep` gives the places the appeal needs (by default, plan IDs stated by position or known); `dropped`,
    the (kind, value) of each span combine dropped inside a control place."""
    t0 = time.perf_counter()
    try:
        verdict = _verdict(source, output, mapping, known, keep, dropped)
    except Exception:  # noqa: BLE001  fail closed: an error holds the case, it never lets one through
        verdict = Residual(True, ("CHECK_ERROR",), (), 1)
    return Residual(**{**asdict(verdict), "ms": round((time.perf_counter() - t0) * 1000, 3)})
