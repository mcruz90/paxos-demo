"""Interpret trusted offline prescriber registry entries for typed tokens."""

import re
from collections.abc import Iterable
from typing import Protocol

UNKNOWN = "PRESCRIBER"
GENERALISTS = frozenset({"FAMILY_PHYSICIAN", "INTERNIST"})
ROLE_BY_CODE = {
    "207Q00000X": "FAMILY_PHYSICIAN",
    "207R00000X": "INTERNIST",
    "207RE0101X": "ENDOCRINOLOGIST",
    "207RR0500X": "RHEUMATOLOGIST",
    "207N00000X": "DERMATOLOGIST",
    "207RG0100X": "GASTROENTEROLOGIST",
    "207RP1001X": "PULMONOLOGIST",
    "207RC0000X": "CARDIOLOGIST",
    "207RH0003X": "HEMATOLOGIST_ONCOLOGIST",
    "207RX0202X": "ONCOLOGIST",
    "207K00000X": "ALLERGIST_IMMUNOLOGIST",
    "207RA0201X": "ALLERGIST_IMMUNOLOGIST",
    "207V00000X": "OB_GYN",
    "207RN0300X": "NEPHROLOGIST",
    "207RI0200X": "INFECTIOUS_DISEASE_PHYSICIAN",
}


def _role(taxonomy: dict) -> str:
    code = taxonomy.get("code", "")
    if code in ROLE_BY_CODE:
        return ROLE_BY_CODE[code]
    last = str(taxonomy.get("desc", "")).split(",")[
        -1
    ]  # "Psychiatry & Neurology, Neurology" -> "Neurology"
    return re.sub(r"[^A-Z0-9]+", "_", last.upper()).strip("_") or UNKNOWN


def role_for(entry: dict) -> str:
    """A registry entry's role: a specialist taxonomy wins over a generalist one (an endocrinologist often lists
    Internal Medicine as primary), then the primary one."""
    taxonomies = sorted(entry.get("taxonomies") or [], key=lambda t: not t.get("primary"))
    roles = [_role(t) for t in taxonomies]
    specialists = [r for r in roles if r not in GENERALISTS]
    return (specialists or roles or [UNKNOWN])[0]


class Registry(Protocol):
    def by_npi(self, npi: str) -> list[dict]: ...
    def by_name(self, first: str, last: str) -> list[dict]: ...


class OfflineRegistry:
    """Entries in the NPPES response shape (number, basic.first_name/last_name, taxonomies[]), held in memory."""

    def __init__(self, entries: Iterable[dict]):
        self.entries = list(entries)

    def by_npi(self, npi: str) -> list[dict]:
        return [e for e in self.entries if e["number"] == npi]

    def by_name(self, first: str, last: str) -> list[dict]:
        key = (first.casefold(), last.casefold())
        return [
            e
            for e in self.entries
            if (e["basic"]["first_name"].casefold(), e["basic"]["last_name"].casefold()) == key
        ]


def specialty(registry: Registry, npi: str | None, name: tuple[str, str] | None) -> str:
    """The role to put in the prescriber's tokens: by NPI, else by a name that matches exactly one prescriber."""
    found = registry.by_npi(npi) if npi else []
    if not found and name:
        found = registry.by_name(*name)
    return role_for(found[0]) if len(found) == 1 else UNKNOWN
