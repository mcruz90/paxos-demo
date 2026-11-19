"""Protect the case facts the case packet already knows. Standard library only. Decision 0028.

A PII model reads clinical and payer words as identifiers: "Humana" as a name, "rheumatoid" as an address, a drug
as a person. With known identity, set 3 still lost 38 facts that way. ClearAuth's case packet holds the requested
drug, the payer and the diagnosis codes before any letter is read, as it holds the patient's identity (decision
0027). Every place the letter writes one of those values is a fact, and no span may cover it:

    drug, payer   the value as a whole word, in any case ("Repatha", "HUMANA")
    diagnosis     the ICD-10 code, and its description as a phrase (any case, any spacing)

A span that covers part of a fact is trimmed to what lies outside it ("Humana, Springfield" keeps
"Springfield"); one wholly inside a fact goes. A span that touches the case's known identity is never trimmed:
a patient named Graves with Graves' disease loses the fact, never the name. Nor is an email address or a phone
number: "jane@cigna.com" holds the payer's name, and cutting it would leave the rest readable. The denial reason
is not protected: ClearAuth learns it from the letter, not the packet.
"""

import re
from collections.abc import Sequence
from dataclasses import dataclass

from security.case_tokens.tokens import Span

WHOLE = ("EMAIL", "PHONE")  # kind suffixes never cut: PATIENT_EMAIL, PRESCRIBER_PHONE, ...


@dataclass(frozen=True)
class KnownFacts:
    drugs: tuple[str, ...] = ()
    payers: tuple[str, ...] = ()
    codes: tuple[str, ...] = ()  # ICD-10-CM: "E11.65"
    descriptions: tuple[str, ...] = ()  # "Type 2 diabetes mellitus with hyperglycemia"


def _phrase(value: str) -> str:
    return r"\s+".join(re.escape(w) for w in value.split())


def ranges(text: str, facts: KnownFacts) -> list[tuple[int, int]]:
    """Every place `text` writes a known fact. A value under 3 characters protects nothing."""
    values = [*facts.drugs, *facts.payers, *facts.codes, *facts.descriptions]
    out = []
    for v in (v.strip() for v in values):
        if len(v) >= 3:
            pattern = rf"(?<!\w){_phrase(v)}(?!\w)"
            out += [(m.start(), m.end()) for m in re.finditer(pattern, text, re.IGNORECASE)]
    return sorted(out)


def _pieces(text: str, s: Span, cut: list[tuple[int, int]]) -> list[Span]:
    """What is left of `s` outside the `cut` ranges, each piece trimmed to its letters and digits."""
    out, pos = [], s.start
    for a, b in [*cut, (s.end, s.end)]:
        piece = re.search(r"\w(?:.*\w)?", text[pos : max(pos, min(a, s.end))], re.DOTALL)
        if piece:
            out.append(Span(pos + piece.start(), pos + piece.end(), s.kind))
        pos = max(pos, b)
    return out


def shield(
    text: str, spans: list[Span], facts: KnownFacts, known: Sequence[Span] = ()
) -> list[Span]:
    """`spans` with every known fact cut out of them, except a span touching a known identity value."""
    cut = ranges(text, facts)
    out = []
    for s in spans:
        inside = [(a, b) for a, b in cut if a < s.end and s.start < b]
        whole = s.kind.endswith(WHOLE) or any(k.start < s.end and s.start < k.end for k in known)
        out += [s] if whole or not inside else _pieces(text, s, inside)
    return out
