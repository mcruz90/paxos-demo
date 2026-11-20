"""Identifiers read by their element in an NCPDP SCRIPT XML message (decision 0034). Standard library only.

A message is XML whose root element is in the SCRIPT namespace. Each element holding text is read by its name and
the elements around it:
    Patient        Name (last, first, middle when longer than one letter), DateOfBirth, Address below the state,
                   every CommunicationNumbers number and email, Identification typed by its element
    Benefits...    CardholderID and CardholderName (Safe Harbor (A) covers a relative); GroupID, PCN and
                   BINLocationNumber are case facts, returned by facts() for combine to protect
    Prescriber     Name, Identification/NPI and CommunicationNumbers, as prescriber kinds; not its address
Never read: the pharmacy and payer (organisations), the drug, diagnoses, notes and free-text answers. A text holding
a DOCTYPE or an entity declaration is not read, as for FHIR XML. The root's version attributes are controls()
(decision 0034, section 13).
"""

import re
from collections.abc import Iterator

from security.case_tokens.tokens import Span

_ROOT = re.compile(
    r"<(?:[\w.-]+:)?Message\b[^<>]*\bxmlns(?::[\w.-]+)?\s*=\s*([\"'])"
    r"http://www\.ncpdp\.org/schema/SCRIPT\1"
)
_TAG = re.compile(r"<(/?)(?:[\w.-]+:)?([A-Za-z][\w.-]*)\b[^<>]*?(/?)>")
SKIPPED = ("Pharmacy", "Payer", "Note", "MedicationPrescribed", "QuestionSet", "Response")
NAMES = ("LastName", "FirstName", "MiddleName")
ADDRESS = ("AddressLine1", "AddressLine2", "AddressLine3", "City", "PostalCode")
PATIENT_IDS = {"SocialSecurity": "SSN", "MedicalRecordIdentificationNumberEHR": "MRN"}
PATIENT_IDS |= {"PatientAccountNumber": "ACCOUNT_NUMBER"}
FACTS = ("GroupID", "PCN", "BINLocationNumber")
VERSIONS = (
    "2017071",
    "20170715",
    "2022011",
    "2023011",
)  # the SCRIPT releases: a version's fixed values
_VERSION = re.compile(r"\b[A-Za-z]*Version\s*=\s*([\"'])(\d{1,8})\1")

Leaf = tuple[tuple[str, ...], str, int]  # the element path, the text, its offset in the letter


def leaves(text: str) -> Iterator[Leaf]:
    """Every element of each SCRIPT message that holds text and no child element, with its path."""
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        return
    for root in _ROOT.finditer(text):
        path: list[str] = []
        opened: tuple[str, int] | None = (
            None  # the last start tag, while nothing followed it but text
        )
        for m in _TAG.finditer(text, root.start()):
            closing, name, empty = m.groups()
            if not closing:
                if not empty:
                    path.append(name)
                    opened = (name, m.end())
                continue
            if opened and opened[0] == name and path and path[-1] == name:
                yield tuple(path), text[opened[1] : m.start()], opened[1]
            opened = None
            if path and path[-1] == name:
                path.pop()
            if not path:
                break


def _patient_kind(name: str, inside: set[str]) -> str | None:
    """An element under Patient that is neither a contact nor a name."""
    if "Identification" in inside:
        return PATIENT_IDS.get(name, "MEMBER_ID")
    if "DateOfBirth" in inside:
        return "DOB"
    return "ADDRESS" if "Address" in inside and name in ADDRESS else None


def _kind(path: tuple[str, ...], value: str) -> str | None:
    name, inside = path[-1], set(path[:-1])
    if inside & set(SKIPPED):
        return None
    prefix = "PRESCRIBER_" if inside & {"Prescriber", "Supervisor"} else ""
    if "CommunicationNumbers" in inside:
        kind = {"ElectronicMail": "EMAIL", "Number": "PHONE"}.get(name)
        return prefix + kind if kind else None
    if inside & {"Name", "CardholderName"} and name in NAMES:
        initial = name == "MiddleName" and len(value.strip()) < 2  # a middle initial is not read
        return None if initial else f"{prefix or 'PATIENT_'}NAME"
    if prefix:
        return "PRESCRIBER_NPI" if name == "NPI" else None
    if "Patient" in inside:
        return _patient_kind(name, inside)
    return "MEMBER_ID" if name == "CardholderID" else None


def spans(text: str) -> list[Span]:
    """Every identifier the SCRIPT messages in `text` state by element."""
    out = []
    for path, value, at in leaves(text):
        kind = _kind(path, value) if value.strip() else None
        if kind:
            out.append(Span(at, at + len(value), kind))
    return out


def facts(text: str) -> list[tuple[int, int]]:
    """Where the messages state a group, PCN or BIN: plan facts, never identifiers."""
    return [
        (at, at + len(v))
        for path, v, at in leaves(text)
        if path[-1] in FACTS and "BenefitsCoordination" in path
    ]


def controls(text: str, constant: bool = False) -> list[tuple[int, int]]:
    """The version attributes of each SCRIPT message's root (DatatypesVersion="2017071"): the schema's (decision
    0034, section 13). With `constant`, only a version in VERSIONS: any other digits are opaque. combine drops a span
    inside a constant and tokenizes an opaque one."""
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        return []
    out = []
    for root in _ROOT.finditer(text):
        end = text.find(">", root.end())
        found = _VERSION.finditer(text, root.start(), end if end >= 0 else len(text))
        out += [(m.start(2), m.end(2)) for m in found if not constant or m.group(2) in VERSIONS]
    return out
