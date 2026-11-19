"""The written forms the output check looks for, one value at a time (decision 0034, section 1). Standard library.

Every pattern is built from escaped text, with bounded gaps and no nested quantifiers, and runs on a folded copy of
the output (residual.fold). A value's forms are joined into one pattern, scanned once; a value too short to search
safely gives none.
"""

import re
from datetime import date

from security.case_tokens.deidentify import PARTICLES, name_forms
from security.case_tokens.kinship import HONORIFICS
from security.case_tokens.known_identity import MONTHS, _date_forms

MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()
TWO_LETTER_PARTICLES = frozenset(p for p in PARTICLES if len(p) == 2) | {"ap", "ab"}
ROMAN_SUFFIXES = frozenset({"II", "III", "IV", "V", "VI"})


def _suffix(word: str, keep_roman: bool = False) -> bool:
    """A generational suffix after a surname: Jr or Sr, or (unless `keep_roman`) a Roman numeral in capitals ("Anh Vi"
    keeps Vi)."""
    return word.casefold().rstrip(".") in ("jr", "sr") or (
        not keep_roman and word in ROMAN_SUFFIXES
    )


_WORD = re.compile(r"[^\W\d_]+(?:['\-][^\W\d_]+)*")
_EDGE_L, _EDGE_R = r"(?<![^\W_])", r"(?![^\W_])"  # not inside a word
_ALNUM_L, _ALNUM_R = r"(?<![A-Za-z0-9])", r"(?![A-Za-z0-9])"


def _literal(text: str, any_case: bool = False) -> str:
    """`text` as a whole word or number, its spaces matching any run of whitespace."""
    body = r"\s+".join(re.escape(w) for w in text.split())
    return f"(?i:{_EDGE_L}{body}{_EDGE_R})" if any_case else f"{_EDGE_L}{body}{_EDGE_R}"


def _spread(chars: str, gap: int) -> str:
    """`chars` in order, case-insensitive, with up to `gap` non-alphanumerics between any two, not inside a run."""
    body = f"[^A-Za-z0-9]{{0,{gap}}}".join(re.escape(c) for c in chars)
    return f"(?i:{_ALNUM_L}{body}{_ALNUM_R})"


def _word_forms(word: str) -> list[str]:
    """One word of a name: as written, capitalised or in capitals; never in lower case alone, even when the value
    writes it so ("doctor Remy Ochoa": decision 0034, section 8)."""
    written = set() if word[:1].islower() else {word}
    return [_literal(w) for w in written | {word[:1].upper() + word[1:].lower(), word.upper()}]


def _surnames(value: str) -> set[str]:
    """Possible surnames: each non-particle word before a comma, else the last word that is not a generational suffix
    ("Lemaire II": Lemaire). In a name all in capitals a Roman numeral may be the surname ("ANH VI"), so both
    readings are returned (security review)."""
    if "," in value:
        before = value.split(",", 1)[0].split()
        return {w for w in before if w.casefold() not in PARTICLES} or set(before[:1])
    words, caps = value.split(), value.isupper()
    readings = set()
    for keep_roman in (caps, False):
        rest = list(words)
        while len(rest) > 1 and _suffix(rest[-1].strip(".,"), keep_roman):
            rest.pop()
        readings |= {rest[-1]} if rest else set()
    return readings


def names(value: str) -> list[str]:
    words = [w for w in value.split() if w.casefold().rstrip(".") not in HONORIFICS]
    value = " ".join(words).strip(" ,.")
    if not value:
        return []
    out = [_literal(f, any_case=True) for f in name_forms(value) if " " in f.strip()]
    parts = value.replace(",", " ").split()
    if len(parts) == 2 and "," not in value:
        out.append(_literal(f"{parts[1]} {parts[0]}", any_case=True))
    for w in _WORD.findall(value):
        if len(w) >= 3 and w.casefold() not in PARTICLES:
            out += _word_forms(w)
    for last in _surnames(value):
        if len(last) == 2 and last.isalpha() and last.casefold() not in TWO_LETTER_PARTICLES:
            # as written only (May, 2026-10-29); a value in capitals says nothing of the case, so also capitalised
            forms = (
                set()
                if last[0].islower()
                else {last} | ({last.capitalize()} if value.isupper() else set())
            )
            out += [_literal(f) for f in forms]
    return out


def _month(word: str) -> int | None:
    w = word.casefold().rstrip(".")
    for names_ in (MONTHS, MESES):
        for i, m in enumerate(names_):
            if len(w) >= 3 and m.casefold().startswith(w):
                return i + 1
    return None


def _valid(y: int, m: int, d: int) -> bool:
    try:
        date(y, m, d)
    except ValueError:
        return False
    return 1900 <= y <= 2100


def _numeric(nums: list[str]) -> set[tuple[int, int, int]]:
    if len(nums) == 1 and len(nums[0]) == 8:
        n = nums[0]
        candidates = [(n[:4], n[4:6], n[6:]), (n[4:], n[:2], n[2:4]), (n[4:], n[2:4], n[:2])]
    elif len(nums) == 3 and len(nums[0]) == 4:
        candidates = [(nums[0], nums[1], nums[2])]
    elif len(nums) == 3 and len(nums[2]) in (2, 4):
        y = nums[2] if len(nums[2]) == 4 else ("19" if int(nums[2]) > 26 else "20") + nums[2]
        candidates = [(y, nums[0], nums[1]), (y, nums[1], nums[0])]
    else:
        return set()
    return {(int(y), int(m), int(d)) for y, m, d in candidates if _valid(int(y), int(m), int(d))}


def parse_dates(value: str) -> set[tuple[int, int, int]]:
    """Every (year, month, day) the value can be read as: both ways when day and month are ambiguous."""
    nums = re.findall(r"\d+", value)
    month = next((m for w in re.findall(r"[^\W\d_]+", value) if (m := _month(w))), None)
    if month is None:
        return _numeric(nums)
    years = [int(n) for n in nums if len(n) == 4]
    days = [int(n) for n in nums if len(n) <= 2]
    if not years and len(days) == 2:  # "Mar 3 '58": the day, then a two-digit year
        years, days = [days[1] + (1900 if days[1] > 26 else 2000)], days[:1]
    return (
        {(years[0], month, days[0])}
        if years and days and _valid(years[0], month, days[0])
        else set()
    )


def _date_patterns(y: int, m: int, d: int) -> list[str]:
    mon = MONTHS[m - 1][:3].upper()
    written = [
        *_date_forms(f"{y}-{m:02d}-{d:02d}"),
        f"{y}{m:02d}{d:02d}",
        f"{d:02d}/{m:02d}/{y}",
        f"{d}/{m}/{y}",
        f"{d:02d}-{m:02d}-{y}",
        f"{d:02d}.{m:02d}.{y}",
        f"{d:02d}-{mon}-{y}",
        f"{d} de {MESES[m - 1]} de {y}",
        *(
            f"{name} {d} {yy}"
            for name in (MONTHS[m - 1], MONTHS[m - 1][:3])
            for yy in (f"'{y % 100:02d}", f"{y % 100:02d}")
        ),
        f"{m}/{d}/{y % 100:02d}",
    ]
    out = [_literal(f, any_case=True) for f in written]
    return out + [
        _spread(s, 2) for s in (f"{y}{m:02d}{d:02d}", f"{m:02d}{d:02d}{y}", f"{d:02d}{m:02d}{y}")
    ]


def dates(value: str) -> list[str]:
    # also searched as written when it has a run of digits, parsed or not; never "Thu" or "09" (section 8)
    digits = re.search(r"\d{2}", value) and len(re.sub(r"\W", "", value)) >= 4
    written = [_literal(value, any_case=True)] if digits else []
    return written + [p for ymd in sorted(parse_dates(value)) for p in _date_patterns(*ymd)]


def numbers(value: str) -> list[str]:
    chars = re.sub(r"[^A-Za-z0-9]", "", value)
    if not any(
        c.isdigit() for c in chars
    ):  # "CLINIC" read as a member ID is not searched (section 8)
        return []
    if len(chars) >= 6:
        return [_spread(chars, 3)]
    # four or five with a letter: exactly as written, never inside a longer run ("QX12", not "QX123" or "QX-12";
    # R5-2). Not "NM1", "271" or "1016": X12 segment names, transaction sets and times models read as IDs
    letter = any(c.isalpha() for c in chars)
    return [f"{_ALNUM_L}{re.escape(value.strip())}{_ALNUM_R}"] if len(chars) >= 4 and letter else []


def phones(value: str) -> list[str]:
    digits = re.sub(r"\D", "", value)
    if len(digits) < 7:
        return []
    body = "[^A-Za-z0-9]{0,3}".join(digits[-10:] if len(digits) >= 10 else digits[-7:])
    prefix = r"(?:\+?1[^A-Za-z0-9]{0,3})?" if len(digits) >= 10 else ""
    return [rf"(?<![A-Za-z0-9+]){prefix}\(?{body}{_ALNUM_R}"]


def emails(value: str) -> list[str]:
    v = value.strip()
    return [rf"(?i:(?<![\w.+-]){re.escape(v)}(?![\w-]|\.\w))"] if "@" in v else []


def _address_part(part: str) -> list[str]:
    p = part.strip()
    zip_code = re.fullmatch(r"(?:[A-Z]{2}\s+)?(\d{5})(?:-?(\d{4}))?", p)
    if zip_code:
        five, four = zip_code.groups()
        return [_spread(five, 0)] + ([_spread(five + four, 1)] if four else [])
    if re.fullmatch(r"[A-Z]{2}", p) or len(re.sub(r"\W", "", p)) < 3:
        return []  # the state stays (Safe Harbor (B)); a fragment is too short
    if re.match(r"\d+[A-Za-z]?\s+\S", p) or re.match(
        r"(?i)(?:apt|unit|suite|ste|bldg|floor|fl|#)\s*#?\d", p
    ):
        return [_literal(p, any_case=True)]  # a street line, or a unit ("Apt2", "#12B")
    if any(c.isdigit() for c in p):
        # any other line with digits needs a word and a space; "005010X217" and "AddressLine1" have neither
        return (
            [_literal(p, any_case=True)]
            if re.search(r"\s", p) and re.search(r"[A-Za-z]{2}", p)
            else []
        )
    capitalised = " ".join(w[:1].upper() + w[1:] for w in p.split())
    return [
        _literal(f) for f in {p, capitalised, p.upper()}
    ]  # a city: as written, capitalised or in capitals


def addresses(value: str) -> list[str]:
    return [pat for part in re.split(r"[,\n]", value) for pat in _address_part(part)]


FORMS = {
    "PATIENT_NAME": names,
    "PRESCRIBER_NAME": names,
    "DOB": dates,
    "PHONE": phones,
    "PRESCRIBER_PHONE": phones,
    "EMAIL": emails,
    "PRESCRIBER_EMAIL": emails,
    "ADDRESS": addresses,
}


_NUMBER_KINDS = ("PHONE", "PRESCRIBER_PHONE")


def could_match(kind: str, value: str, lower: str, skeleton: str) -> bool:
    """A cheap test that rules most values out before any pattern is built: every form of a value holds one of
    its words (names, addresses, emails), its letters and digits in a run (IDs, phones), or its year's last two
    digits (dates). `lower` is the folded output in lower case, `skeleton` its letters and digits alone."""
    if kind == "DOB":
        years = {f"{y % 100:02d}" for y, _, _ in parse_dates(value)}
        if years:
            return any(y in skeleton for y in years)
    if kind in FORMS and kind not in _NUMBER_KINDS:
        return any(w.casefold() in lower for w in re.findall(r"[^\W_]{2,}", value))
    chars = re.sub(r"[^A-Za-z0-9]", "", value).casefold()
    tail = (
        chars[-10:]
        if kind in _NUMBER_KINDS and len(chars) >= 10
        else chars[-7:]
        if kind in _NUMBER_KINDS
        else chars
    )
    return bool(tail) and tail in skeleton


def forms(kind: str, value: str) -> re.Pattern[str] | None:
    """One pattern for every form of one value of `kind` (any other kind is an ID), or None when it has none."""
    found = FORMS.get(kind, numbers)(value)
    return re.compile("|".join(f"(?:{p})" for p in dict.fromkeys(found))) if found else None
