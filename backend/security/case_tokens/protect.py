"""Where a letter states what the appeal needs, so no identifier span may cover it. Standard library only.

    protected   a cued plan or group ID ("plan", "group", "GRP", "RxGrp") and a toll-free (payer) number
    kept        those, the plan and group numbers a format states by position (fields.facts, decision 0034) and
                the case's known plan IDs (known_identity.protected)

combine drops any span touching one; the output check (residual.py) ignores a hit inside one.
"""

import re

from security.case_tokens import fields, known_identity
from security.case_tokens.deidentify import TOLL_FREE

_PLAN = re.compile(
    r"\b(?:plan|group|grp|rxgrp)[ \t]*(?:id|number|no\.?|#)?\s*[:#]?\s*"
    r"(?P<v>(?=[A-Za-z\-]*\d)[A-Za-z0-9][A-Za-z0-9\-]{2,29})",
    re.IGNORECASE,
)
_TOLL_FREE = re.compile(
    r"\b(?:1[ .-]?)?\(?(?:"
    + "|".join(sorted(TOLL_FREE))
    + r")\)?[ .-]?(?:\d{3}[ .-]?\d{4}|[A-Z]{7})\b"
)


def protected(text: str) -> list[tuple[int, int]]:
    """Where the letter states its plan or group ID or a toll-free (payer) number: any span touching one is
    dropped. ICD-10 codes are protected more narrowly, in combine."""
    return [(m.start("v"), m.end("v")) for m in _PLAN.finditer(text)] + [
        (m.start(), m.end()) for m in _TOLL_FREE.finditer(text)
    ]


def kept(text: str, known: known_identity.KnownIdentity | None = None) -> list[tuple[int, int]]:
    """Every place in `text` a span must not cover: protected(), the facts a format states by position, and the
    case's known plan IDs."""
    return (
        protected(text)
        + fields.facts(text)
        + (known_identity.protected(text, known) if known else [])
    )
