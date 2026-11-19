"""A regex baseline for ClearAuth's identifier tokenizer (ADR-0014, P9). Standard library only.

    deidentify(text, registry) -> Tokenized(text, mapping)

It finds spans with patterns (detect), then hands them to ports/clearauth/tokens.py. That module decides whose
identifier each span is, names the tokens with the prescriber's specialty (ports/clearauth/npi.py), and can
rehydrate. A PII model plugs in at the same point: its spans go through the same tokens.py.

This is the floor a model has to beat, not a production design. It finds a name only where a label, a
salutation or "Dr." introduces it, then removes every other mention of that name.

With normalise_first (the default) it first removes invisible characters and folds look-alike letters inside
Latin words, as the handoff asks. normalise_first=False shows what a tokenizer misses without that step.
"""

import re
import unicodedata
from collections.abc import Callable, Collection

from security.case_tokens.npi import Registry, specialty
from security.case_tokens.tokens import Span, Specialty, Tokenized, assign_roles, tokenize

# letters are a few thousand characters; a longer text is held whole, never cut, before costly work (R5-5)
MAX_INPUT = 100_000
TOLL_FREE = frozenset(
    {"800", "833", "844", "855", "866", "877", "888"}
)  # a payer's line, not the patient's

_INVISIBLE = re.compile(
    "[\u200b-\u200f\u2060\ufeff\u00ad\u202a-\u202e\u2066-\u2069\U000e0000-\U000e007f]"
)
_LOOKALIKE = str.maketrans(  # Cyrillic -> Latin
    "\u0430\u0435\u043e\u0440\u0441\u0445\u0443\u0456\u0410\u0412\u0415\u041a\u041c\u041d\u041e\u0420\u0421\u0422\u0425",
    "aeopcxyiABEKMHOPCTX",
)
_WORD_RUN = re.compile(
    r"\w+"
)  # each run once: a leading "\w*" rescanned digit runs (R5-5, quadratic)
_LATIN = re.compile("[A-Za-z]")
_I = re.IGNORECASE

_WORD = r"[A-Z][A-Za-z'\-]+"
_LOWER = r"(?:(?![A-Z\d_])[\w'\-]){2,40}"  # a word with no capital, any script's letters ("ka\u02bbahanui")
# common surname particles (Romance, Germanic, Dutch, Arabic, "Saint"): part of the family name ("De La Cruz")
PARTICLES = frozenset(
    {
        "bin",
        "binti",
        "da",
        "das",
        "de",
        "del",
        "della",
        "der",
        "des",
        "di",
        "do",
        "dos",
        "du",
        "ibn",
        "la",
        "le",
    }
    | {"st.", "ste.", "ten", "ter", "van", "von"}
)
_PARTICLE = "(?i:" + "|".join(re.escape(p) for p in sorted(PARTICLES, key=len, reverse=True)) + ")"
_NAME = rf"(?P<name>{_WORD},?\s{_WORD})"
# a salutation's name: the PII models' scores may filter it (ports/clearauth/salutation.py, decision 0035)
SALUTATION = re.compile(rf"\b(?:Dear|Hello|Hi)\s+{_NAME}\s*,")
_PATIENT_CUES = [
    re.compile(
        rf"^[ \t]*(?i:patient(?:\s+name)?|enrollee|member(?:\s+name)?|name)[ \t]*:[ \t]*{_NAME}",
        re.MULTILINE,
    ),
    re.compile(rf"\bmy patient,\s+{_NAME}"),
    re.compile(rf"\bRE:\s*Patient\s+{_NAME}"),
    # a provider appeal's RE line: "RE: Maria Okafor, DOB ..." (docs/research/real-letters.md, section 3)
    re.compile(rf"\bRE:\s*{_NAME}\s*,\s*(?i:DOB|date\s+of\s+birth|member|policy)"),
    # an OCR'd fax's RE line in lower case, "RE: vu, leopoldo    DOB: ...": a name only before a birth date (dev7)
    re.compile(
        rf"\b(?i:re):[ \t]*(?P<name>{_LOWER},[ \t]*{_LOWER})(?=[ \t]+(?i:DOB|date[ \t]+of[ \t]+birth)\b)"
    ),
    # a "Re:" line that holds only "Last, First": a claims or fax letter's subject (decision 0027)
    re.compile(
        rf"^[ \t]*(?i:re):[ \t]*(?P<name>(?:{_PARTICLE}[ \t])*{_WORD},[ \t]*{_WORD})[ \t]*$",
        re.MULTILINE,
    ),
    # a form's split name fields: "Patient last name: Young", "First Name: Mei" (one word each)
    re.compile(
        r"^[ \t]*(?i:(?:patient|member|enrollee)[ \t]+)?(?i:last|first|given|family|sur)[ \t]*(?i:name)[ \t]*:[ \t]*"
        r"(?P<name>[A-Z][A-Za-z'\-]+(?:[ \t][A-Z][A-Za-z'\-]+)?)",
        re.MULTILINE,
    ),
]
_PRESCRIBER_CUES = [re.compile(rf"\bDr\.?\s+{_NAME}")]
_DATE = r"(?:\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2}|[A-Z][a-z]+\s+\d{1,2},\s+\d{4})"
_DOB = re.compile(rf"\b(?:DOB|date\s+of\s+birth|born(?:\s+on)?)\s*[:#]?\s*(?P<v>{_DATE})", _I)
# an ID has a digit; a dot or hyphen only between two of its characters ("QH.306.495.844", never a sentence's end)
_ID = r"(?P<v>(?=[A-Za-z.\-]*\d)[A-Za-z0-9](?:[.\-]?[A-Za-z0-9]){2,29})"
_MEMBER_CUE = (
    r"member\s*(?:id|number|#)|id\s+number|subscriber\s+id|policy\s+number"
    r"|n[u\u00fa]mero\s+de\s+(?:miembro|afiliado)|id\s+de\s+miembro"  # a Spanish notice (dev7)
)
_MEMBER = re.compile(rf"\b(?:{_MEMBER_CUE})\s*[:#]?\s*{_ID}", _I)
_CLAIM = re.compile(rf"\bclaim\s*(?:number|#|no\.?)?\s*[:#]?\s*{_ID}", _I)
_NPI = re.compile(r"\bNPI\s*[:#]?\s*(?P<v>\d{10})\b")
# tried once per run of address characters: started at every word, a run with no "@" was rescanned (R5-5)
_EMAIL = re.compile(r"(?<![\w.+-])[.+-]*(?P<v>\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b)")
_PHONE = re.compile(r"(?<![\d-])\(?(?P<area>\d{3})\)?[ .-]?\d{3}[ .-]\d{4}(?!\d)")
_SUFFIX = (
    r"(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way|Place|Pl)\.?"
)
_ADDRESS = re.compile(
    rf"\b\d{{1,5}}\s+(?:{_WORD}\s+){{1,3}}{_SUFFIX}(?:,?\s*\n?\s*{_WORD}(?:\s{_WORD})*,\s*[A-Z]{{2}}\s+\d{{5}}(?:-\d{{4}})?)?"
)


def normalise(text: str) -> str:
    """No invisible characters, compatibility forms folded, look-alike letters folded inside Latin words."""
    text = unicodedata.normalize("NFKC", _INVISIBLE.sub("", text))
    return _WORD_RUN.sub(
        lambda m: m.group().translate(_LOOKALIKE) if _LATIN.search(m.group()) else m.group(), text
    )


def _surname(words: list[str]) -> str:
    """The last word, with the particles right before it ("De La Cruz", "van Dijk"); the first word never counts."""
    i = len(words) - 1
    while i > 1 and words[i - 1].casefold() in PARTICLES:
        i -= 1
    return " ".join(words[i:])


def name_forms(raw: str) -> set[str]:
    """Every way a name can appear again: as written, both orders, and the surname alone (with its particles)."""
    parts = [p for p in re.split(r",\s*|\s", raw) if p]
    if (
        len(parts) < 2
    ):  # one word, perhaps with a comma after it ("Okafor,"): itself and the bare word
        return {raw} | ({parts[0]} if parts and len(parts[0]) >= 3 else set())
    if (
        "," in raw
    ):  # the words either side of the comma, even when a span took a word before ("Reached YOUNG, ...")
        before, after = raw.split(",", 1)
        words = before.split() or [parts[0]]
        last = _surname(["", *words]) if words[0].casefold() in PARTICLES else _surname(words)
        first = (after.split() or [parts[1]])[0]
    else:
        first, last = parts[0], _surname(parts)
    bare = last.split()[-1]
    return {raw, f"{first} {last}", f"{last}, {first}"} | {f for f in (last, bare) if len(f) >= 3}


def _mentions(
    text: str, cues: list[re.Pattern[str]], kind: str, names: list[str] | None = None
) -> list[Span]:
    raw = [m.group("name") for cue in cues for m in cue.finditer(text)] + (names or [])
    forms = {f for name in raw for f in name_forms(name)}
    return [
        Span(m.start(), m.end(), kind)
        for form in forms
        for m in re.finditer(rf"(?<!\w){re.escape(form)}(?!\w)", text, flags=_I)
    ]


def _values(text: str, pattern: re.Pattern[str], kind: str) -> list[Span]:
    return [Span(m.start("v"), m.end("v"), kind) for m in pattern.finditer(text)]


def salutation_names(text: str, keep: Callable[[int, int], bool] | None = None) -> list[str]:
    """The names the salutation cue finds, less those `keep` rejects (by their offsets)."""
    return [
        m.group("name")
        for m in SALUTATION.finditer(text)
        if keep is None or keep(m.start("name"), m.end("name"))
    ]


def detect(text: str, keep_salutation: Callable[[int, int], bool] | None = None) -> list[Span]:
    """Every identifier span the patterns find, patient's or prescriber's (assign_roles decides which).
    `keep_salutation` filters the salutation cue's names only (decision 0035); None keeps them all."""
    return [
        *_mentions(text, _PRESCRIBER_CUES, "PRESCRIBER_NAME"),
        *_mentions(text, _PATIENT_CUES, "PATIENT_NAME", salutation_names(text, keep_salutation)),
        *_values(text, _DOB, "DOB"),
        *_values(text, _MEMBER, "MEMBER_ID"),
        *_values(text, _CLAIM, "CLAIM_NUMBER"),
        *_values(text, _NPI, "PRESCRIBER_NPI"),
        *_values(text, _EMAIL, "EMAIL"),
        *(Span(m.start(), m.end(), "ADDRESS") for m in _ADDRESS.finditer(text)),
        *(
            Span(m.start(), m.end(), "PHONE")
            for m in _PHONE.finditer(text)
            if m.group("area") not in TOLL_FREE
        ),
    ]


def prescriber_role(registry: Registry) -> Specialty:
    """The specialty function tokens.tokenize calls once per prescriber: by NPI, else by full name."""
    return lambda npi, name: specialty(registry, npi, name)


def deidentify(
    text: str,
    registry: Registry,
    normalise_first: bool = True,
    mapping: dict[str, str] | None = None,
    reserved: Collection[str] = (),
) -> Tokenized:
    """The text with the patient's and the prescriber's identifiers replaced by typed tokens, and the mapping.
    `mapping`: the case's token table so far, extended; `reserved`: tokens never to issue (tokens.tokenize)."""
    if normalise_first:
        text = normalise(text)
    return tokenize(
        text, assign_roles(text, detect(text)), prescriber_role(registry), mapping, reserved
    )
