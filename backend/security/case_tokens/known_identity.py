"""Layer 1 of ClearAuth's ADR-0014: tokenize the identity values the case already knows. Standard library only.

ClearAuth's case packet (`PatientContext`, `CasePacket.coverage`) holds the patient's name, birth date, member ID
and address, the prescriber's name, NPI and phone, and the plan and group IDs, before any letter is read. Every
written form of those values is an identifier, whatever a model or a cue says:

    name      the full name in either order ("Will Wilson", "Wilson, Will"), in any case; a single word of it (the
              first name alone, the surname alone, each word of a two-word name) only when capitalised or in
              capitals, so "I will call" keeps its "will"
    birth     every common date style ("03/14/1961", "March 14, 1961", "14 Mar 1961", "1961-03-14", ...)
    numbers   the member ID, NPI and phone with any spaces, dashes, dots or brackets between their characters
    address   the street line, any unit line, the city before its state, and the ZIP code

A known plan or group ID is protected: it is never tokenized, whatever a model calls it. Decision 0027. So are the
known facts it may carry (the drug, payer and diagnosis, ports/clearauth/known_facts.py; decision 0028).

The values come from the case, never from the letter. A one-string name (`PatientContext.patient_name`) is split
at its first surname particle, else before its last word; a structured name (given, family) needs no guess.
"""

import re
from dataclasses import dataclass

from security.case_tokens.deidentify import PARTICLES
from security.case_tokens.known_facts import KnownFacts
from security.case_tokens.tokens import Span

MONTHS = (
    "January February March April May June July August September October November December".split()
)
_SEP = r"[\s().-]{0,2}"


@dataclass(frozen=True)
class KnownPrescriber:
    given: str
    family: str
    npi: str = ""
    phone: str = ""


@dataclass(frozen=True)
class KnownIdentity:
    given: str
    family: str
    dob: str = ""  # YYYY-MM-DD
    member_id: str = ""
    address: str = ""  # "706 Wexford Crescent, Apt 5C, Normal, IL 61761"
    prescribers: tuple[KnownPrescriber, ...] = ()
    plan_ids: tuple[str, ...] = ()  # plan and group IDs: protected
    facts: KnownFacts | None = None  # the drug, payer and diagnosis: protected (decision 0028)

    @classmethod
    def from_full_name(cls, name: str, **values) -> "KnownIdentity":
        given, family = split_name(name)
        return cls(given=given, family=family, **values)


def split_name(full: str) -> tuple[str, str]:
    """("Mirela", "De La Cruz") from "Mirela De La Cruz": the family name starts at the first particle after the
    first word, else it is the last word."""
    words = full.split()
    for i, w in enumerate(words[1:-1], 1):
        if w.casefold() in PARTICLES:
            return " ".join(words[:i]), " ".join(words[i:])
    return " ".join(words[:-1]), words[-1] if words else ""


def _phrase(words: str) -> str:
    return r"\s+".join(re.escape(w) for w in words.split())


def _find(text: str, pattern: str, kind: str, flags: int = 0) -> list[Span]:
    return [
        Span(m.start(), m.end(), kind) for m in re.finditer(rf"(?<!\w){pattern}(?!\w)", text, flags)
    ]


def _word(text: str, word: str, kind: str) -> list[Span]:
    """One word of a name: as written, capitalised, or in capitals; never in lower case inside a sentence."""
    forms = {word, word.upper(), word[:1].upper() + word[1:]}
    return [s for f in forms for s in _find(text, re.escape(f), kind)]


def name_spans(text: str, given: str, family: str, kind: str) -> list[Span]:
    if not given.strip() or not family.strip():
        return []
    out = [
        s
        for form in {f"{given} {family}", f"{family}, {given}", f"{family} {given}", family}
        if " " in form
        for s in _find(text, _phrase(form), kind, re.IGNORECASE)
    ]
    words = given.split() + [w for w in family.split() if w.casefold() not in PARTICLES] + [family]
    return out + [s for w in words if len(w) >= 2 for s in _word(text, w, kind)]


def _date_forms(iso: str) -> list[str]:
    y, m, d = (int(x) for x in iso.split("-"))
    month = MONTHS[m - 1]
    return [
        f"{m:02d}/{d:02d}/{y}",
        f"{m}/{d}/{y}",
        f"{m:02d}-{d:02d}-{y}",
        f"{m:02d}/{d:02d}/{y % 100:02d}",
        f"{y}-{m:02d}-{d:02d}",
        f"{month} {d}, {y}",
        f"{month[:3]} {d}, {y}",
        f"{month[:3]}. {d}, {y}",
        f"{d} {month} {y}",
        f"{d} {month[:3]} {y}",
    ]


def loose(value: str, kind: str, text: str) -> list[Span]:
    """An ID or phone with any separators between its characters (a phone may start with +1)."""
    chars = [re.escape(c) for c in re.sub(r"[^A-Za-z0-9]", "", value)]
    if not chars:
        return []
    prefix = r"(?:\+?1[\s.-]?)?" if kind.endswith("PHONE") else ""
    pattern = rf"(?<![A-Za-z0-9+]){prefix}\(?{_SEP.join(chars)}(?![A-Za-z0-9])"
    return [Span(m.start(), m.end(), kind) for m in re.finditer(pattern, text, re.IGNORECASE)]


def address_spans(text: str, address: str) -> list[Span]:
    """The street line and any unit line (any case), the city when its state follows, and the ZIP code."""
    parts = [p.strip() for p in address.split(",")]
    if len(parts) < 3:
        return []
    *lines, city, state_zip = parts
    out = [s for line in lines for s in _find(text, _phrase(line), "ADDRESS", re.I)]
    out += [
        Span(m.start(), m.start() + len(city), "ADDRESS")
        for m in re.finditer(rf"(?<!\w){re.escape(city)},\s*[A-Z]{{2}}\b", text, re.IGNORECASE)
    ]
    postal_parts = state_zip.split()
    if postal_parts:
        out += _find(text, re.escape(postal_parts[-1]), "ADDRESS")
    return out


def spans(text: str, known: KnownIdentity) -> list[Span]:
    """Every place `text` writes a value the case knows, with its kind."""
    out = name_spans(text, known.given, known.family, "PATIENT_NAME")
    if known.dob:
        out += [
            s
            for f in _date_forms(known.dob)
            for s in _find(text, re.escape(f), "DOB", re.IGNORECASE)
        ]
    out += loose(known.member_id, "MEMBER_ID", text) + address_spans(text, known.address)
    for p in known.prescribers:
        out += name_spans(text, p.given, p.family, "PRESCRIBER_NAME")
        out += loose(p.npi, "PRESCRIBER_NPI", text) + loose(p.phone, "PRESCRIBER_PHONE", text)
    return out


def protected(text: str, known: KnownIdentity) -> list[tuple[int, int]]:
    """Where the letter writes a known plan or group ID."""
    ids = [
        p.strip() for p in known.plan_ids if len(p.strip()) >= 3
    ]  # an empty ID would match everywhere
    return [(s.start, s.end) for p in ids for s in _find(text, re.escape(p), "PLAN", re.IGNORECASE)]
