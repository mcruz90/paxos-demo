"""Recognizers and evidence labels for deterministic denial field extraction."""

import re

LABEL, PHRASE, FALLBACK, NONE = "label", "phrase", "fallback", "none"

_I, _IM = re.IGNORECASE, re.IGNORECASE | re.MULTILINE
_SEP = r"\s*[:|#]?\s*"
_ID = r"([A-Za-z0-9][A-Za-z0-9\-]{2,29})"
_TRADEMARKS = chr(0x00AE) + chr(0x2122) + chr(0x00A9)  # registered, trademark, copyright
_DASHES = "-" + chr(0x2013)
_DRUG = r"(?P<v>[A-Za-z][A-Za-z0-9\-/%.()' ]{1,80}?)"
_VERBS = r"has|have|had|was|were|is|are|does|did|do|cannot|can|could|will|would|under|per|not"
_PAIR = r"(?:[ \t]*/[ \t]*[^\n:|/]{1,40}?(?=[ \t]*[:|]))?"  # a second-language label: "Plan ID / ID del plan:"
_DRUG_END = rf"(?=\s+(?:{_VERBS})\b|[,;\n{_TRADEMARKS}]|\.(?:\s|$)|$)"


def _labelled(labels: str) -> re.Pattern[str]:
    """A 'Label: value' or 'Label | value' line."""
    return re.compile(rf"^[ \t]*(?:{labels}){_PAIR}[ \t]*[:|][ \t]*(?P<v>[^\n]+?)[ \t]*$", _IM)


_DRUG_NOUN = r"drug|medication|medicine|prescription|agent|item|therapy"
_SENT_FOR = (
    r"\b(?:request|pa)\s+(?:your\s+doctor|we|you)\s+(?:sent\s+us|got|received|submitted)\s+for\s+"
)
_DRUG_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (_labelled(rf"(?:requested\s+)?(?:{_DRUG_NOUN})(?:\s+(?:name|requested))?|product"), LABEL),
    (
        re.compile(
            r"\b(?:authorization|auth|coverage|request|approval|pa)\s+for\s+" + _DRUG + _DRUG_END,
            _I,
        ),
        PHRASE,
    ),
    (re.compile(r"\bcoverage\s+of\s+" + _DRUG + _DRUG_END, _I), PHRASE),
    (re.compile(_SENT_FOR + _DRUG + _DRUG_END, _I), PHRASE),
    (
        re.compile(r"^[ \t]*pa\s*#\s*[A-Za-z0-9\-]+[ \t]*\|[ \t]*" + _DRUG + r"[ \t]*\|", _IM),
        PHRASE,
    ),  # PA # | drug |
    (re.compile(r"\btreatment\s+with\s+" + _DRUG + _DRUG_END, _I), PHRASE),
    (
        re.compile(
            r"\b(?:asked|requested)\s+(?:us|that\s+we)\s+(?:to\s+)?cover\s+" + _DRUG + _DRUG_END, _I
        ),
        PHRASE,
    ),
    (re.compile(r"^[ \t]*re:\s*" + _DRUG + r"(?=\s+for\s+(?:member|patient)\b)", _IM), PHRASE),
    (
        re.compile(
            rf"^[ \t]*subject:.*?\b(?:decision|determination)\s*[{_DASHES}:]\s*"
            + _DRUG
            + r"[ \t]*$",
            _IM,
        ),
        PHRASE,
    ),
    (
        re.compile(
            r"\bfor\s+(?!(?:your|the|this|that|our|a|an|more|further|each|all|any)\b)"
            + _DRUG
            + _DRUG_END,
            _I,
        ),
        FALLBACK,
    ),
]
# Another drug in the letter (decision 0037): a cue in a mention's own clause marks it as history or an alternative,
# read the way NegEx and ConText read notes, and the reader moves on. Clauses end at sentence ends, semicolons,
# colons, line breaks and words that start another clause, so in "a trial of atorvastatin before Repatha can be
# covered" the cue governs atorvastatin only. Cues: the development wording's and the usual triggers, none taken
# from the held-out wording.
_CLAUSE_END = re.compile(
    r"\n|[.;:!?](?:\s|$)|,\s+(?:which|but|so)\b|\b(?:because|since|although|but|unless|before|after|until)\b",
    _I,
)
_CLAUSE_WINDOW = 300  # characters either side of a mention; ConText reads a window too
_NOT_REQUESTED = re.compile(
    r"\b(?:previously|earlier|in\s+the\s+past|history\s+of|tried|trials?\s+of|failed|did\s+not\s+respond"
    r"|completed\s+(?:treatment|therapy|a\s+course)|discontinued|stopped|no\s+longer"
    r"|(?:was|were|had\s+been)\s+(?:approved|authorized)|approval\s+has\s+ended|(?:is|was)\s+(?:now\s+)?closed"
    r"|expired|does\s+not\s+require\s+(?:a\s+)?(?:prior\s+)?authorization"
    r"|preferred\s+(?:alternative|drug|product|agent)|formulary\s+alternatives?|try\s+\S+(?:\s+\S+){0,4}\s+first)\b",
    _I,
)
# A "drug" that is really a decision word or an identifier is a misread, not a drug.
_NOT_A_DRUG = re.compile(
    r"^(?:(?:not\s+)?(?:denied|approved|pending|rejected|declined|covered)|under\s+review"
    r"|(?:member|patient|enrollee|plan|group|policy)\b.*)$",
    _I,
)
_PLAN_ID_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bplan\s*(?:id|number|#)" + _PAIR + _SEP + _ID, _I), LABEL),
    (re.compile(r"\bplan\s*:[^\n(|]*\(\s*" + _ID + r"\s*\)", _I), LABEL),
    (
        re.compile(r"\bplan\s*:[^\n(|/]*/\s*" + _ID, _I),
        LABEL,
    ),  # "Patient plan: <payer> / <plan ID>"
    (re.compile(r"\bgroup(?:\s*(?:id|number|#))?" + _SEP + _ID, _I), LABEL),
    (re.compile(r"\bcontract(?:\s*(?:id|number|#))?" + _SEP + _ID, _I), LABEL),
    (re.compile(r"\bpolicy\s*(?:id|number|#)?" + _SEP + _ID, _I), LABEL),
    (
        re.compile(r"\bplan\s+(?:on\s+file\s+(?:is\s+)?)?" + _ID, _I),
        PHRASE,
    ),  # "Plan PLAN-1", "plan on file is ..."
]
_MEMBER_ID = re.compile(r"\b(?:member|enrollee|subscriber)\s*(?:id|number)?\s*[:#|]?\s*" + _ID, _I)
_REASON_LABELS = (
    r"reason\s+for\s+(?:the\s+)?(?:denial|decision|determination)|denial\s+reason|denied\s+because|rationale"
    r"|explanation|basis\s+for\s+(?:the\s+)?(?:decision|denial)|criteria\s+not\s+met|reason|reviewer\s+comments?"
)
_CANNOT_APPROVE = r"\b(?:cannot|can\s*not|could\s+not|are\s+unable\s+to)\s+approve\s+(?:this|your)\s+request\s*\.\s*"
_REASON_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"\b(?:{_REASON_LABELS}){_PAIR}\s*(?:[:|;]|\s[{_DASHES}]\s)\s*", _I), LABEL),
    (re.compile(r"^[ \t]*why[ \t]*:[ \t]*", _IM), LABEL),  # "Why: ..." as a line label only
    (re.compile(r"\bbecause\s*:?\s*", _I), PHRASE),
    (re.compile(r"\bdenied\s*[:;]\s*", _I), PHRASE),
    (re.compile(_CANNOT_APPROVE, _I), PHRASE),
    (
        re.compile(r"\b(?:was|were|has\s+been|is)\s+(?:denied|not\s+approved)\b[^.\n]*\.\s+", _I),
        FALLBACK,
    ),
    (
        re.compile(r"\bdoes\s+not\s+meet\s+(?:the\s+)?(?:coverage\s+)?criteria\s*\.\s+", _I),
        FALLBACK,
    ),
]
_DIAGNOSIS = _labelled(
    r"(?:primary\s+|submitted\s+)?(?:diagnosis|condition|indication)(?:\s+(?:reviewed|code|on\s+file|submitted))?"
)
_PLAN_NAME = _labelled(r"(?:your\s+)?(?:health\s+)?(?:plan|payer|insurance)")
_NDC = re.compile(r"\bNDC\b[^\n\d]{0,30}?(\d[\d-]{8,12}\d)(?![\d-])", _I)
_ICD = re.compile(r"(?<![A-Za-z0-9\-])([A-Z]\d{2}(?:\.[0-9A-Z]{1,4})?)(?![A-Za-z0-9\-])")
_FIELD_LINE = re.compile(r"\n[ \t]*[A-Za-z][A-Za-z0-9 ./#-]{0,40}[ \t]*[:|]")
_ABBREVIATIONS = {"e.g", "i.e", "etc", "vs", "dr", "no", "approx", "incl"}
