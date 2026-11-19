"""Sanitize ingested text and check PDF content for hidden text."""

from __future__ import annotations

import base64
import binascii
import logging
import re
import unicodedata
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SanitizeResult:
    """Outcome of sanitize_extracted_text()."""

    clean_text: str
    suspicious: bool = False
    reason: str = ""


# Removed silently, as shipped: invisible characters with harmless everyday uses.
_STRIP_RE = re.compile("[\x00\u200b\u200c\u200d\u200e\u200f\ufeff\u00ad\u2060]")
_BIDI_RE = re.compile("[\u202a-\u202e\u2066-\u2069]")
_TAG_RE = re.compile("[\U000e0000-\U000e007f]")
_TAG_BASE = 0xE0000

# Compatibility forms folded to plain text in clean_text: fullwidth/narrow and styled letters, and
# no-break spaces. Other compatibility forms (the trademark sign, fractions) are kept as written.
_FOLD_TAGS = ("<wide>", "<narrow>", "<font>", "<noBreak>")
_LIGATURES = range(0xFB00, 0xFB07)

_SCRIPTS = frozenset({"LATIN", "CYRILLIC", "GREEK"})
# Cyrillic and Greek letters drawn the same as a Latin letter.
_LOOKALIKES = frozenset(
    "\u0430\u0435\u043e\u0440\u0441\u0443\u0445\u0456\u0458\u0455\u04bb\u0501"
    "\u0410\u0412\u0415\u041a\u041c\u041d\u041e\u0420\u0421\u0422\u0425\u0406\u0408\u0405"
    "\u03bf\u0391\u0392\u0395\u0396\u0397\u0399\u039a\u039c\u039d\u039f\u03a1\u03a4\u03a5\u03a7"
)
_WORD_RE = re.compile(r"[^\W\d_]+")
_BASE64_RE = re.compile(r"[A-Za-z0-9+/]{24,}={0,2}")

# Run on the folded text (NFKC, casefolded). A letter written to a person has no reason to
# address an AI, switch its persona, dictate its output or verdict, or carry markup.
_INJECTION: dict[str, re.Pattern[str]] = {
    name: re.compile(pattern)
    for name, pattern in {
        "override request": (
            r"(?<!not )(?<!n't )\b(?:ignore|disregard|forget|override|bypass|set aside)\b[^.\n]{0,40}?"
            r"\b(?:instructions?|directions|directives?|rules|guidance|guidelines|prompts?|constraints"
            r"|programming|everything)\b"
        ),
        "role marker": (
            r"(?:^|\n)[ \t]*(?:system|assistant|developer|user)(?: (?:override|message|prompt|instructions?))?"
            r"[ \t]*:|\bsystem (?:override|prompt|message|instructions?)\b"
            # [SYSTEM] or [DEVELOPER] anywhere. [USER]/[ASSISTANT] are also mail-merge fields and portal
            # labels ("Dear [User],"), so only when shaped like a chat turn: closed, starting a line, or both.
            # One [ \t]* per whitespace run: two in a row (around an optional "/" or ":") are retried at
            # every split, quadratic in a long run of spaces.
            r"|\[[ \t]*(?:/[ \t]*)?(?:system|developer)[ \t]*\]|\[[ \t]*/[ \t]*(?:assistant|user)[ \t]*\]"
            r"|(?:^|\n)[ \t]*\[[ \t]*(?:assistant|user)[ \t]*\][ \t]*(?::[ \t]*)?\S"
            # Both roles: lookaheads anchored at the start, so each tag is searched for once (no backtracking).
            r"|\A(?=[\s\S]*?\[[ \t]*user[ \t]*\])(?=[\s\S]*?\[[ \t]*assistant[ \t]*\])"
        ),
        "chat control token": (
            r"<\|[a-z_]{2,20}\|>|\[/?inst\]|<</?sys>>|(?:^|\n)[ \t]*#{2,}[ \t]*(?:instruction|system|response)s?\b"
        ),
        "hidden markup": (
            r"<!--|</?[ \t]*(?:script|style|div|span|iframe|img|meta|object|embed|svg)\b[^>\n]{0,200}>"
            r"|display[ \t]*:[ \t]*none|visibility[ \t]*:[ \t]*hidden|font-size[ \t]*:[ \t]*0"
        ),
        "text addressed to an AI": (
            r"\b(?:note|message|instructions?|prompt) (?:to|for) (?:the |any |all )?(?:ai|a\.i\.|llm|chatbot|bot"
            r"|assistant|language model|model|automated \w+)\b|\b(?:ai|llm|chatbot|assistant|language model)"
            r"[ \t]*[,:][ \t]*(?:please )?(?:also )?(?:you )?(?:must|should|respond|reply|output|write|include"
            r"|list|say|state|approve|ignore|disregard|generate|print|repeat)\b"
        ),
        "persona switch": (
            r"\byou are now (?:in |a |an |the )?(?:dan|developer mode|jailbroken|unrestricted|unfiltered"
            r"|no longer)\b|\bdeveloper mode\b|\bjailbr(?:eak|oken)\b|\bpretend (?:to be|you are|you're"
            r"|that you)\b|\bas dan you must\b"
        ),
        "output coercion": (
            r"\b(?:reveal|print|output|show|repeat|display|leak)\b[^.\n]{0,30}\b(?:system prompt|hidden prompt"
            r"|your (?:instructions|prompt|rules))\b|\b(?:respond|reply|answer) (?:only|solely|just)\b"
        ),
        "verdict coercion": (
            r"\b(?:must|shall) (?:approve|overturn)\b(?! or)|\b(?:approve|overturn|reverse)\b[^.\n]{0,40}"
            r"\b(?:regardless|unconditionally|without (?:changes|review|question|exception))\b"
            r"|(?:^|\n|[.!:;>] *|\b(?<!review )(?:and|then) )(?:approve|overturn) (?:this|the|every|all|any)\b"
            r"|\b(?:treat|mark|consider|declare)\b[^.\n]{0,40}\b(?:as approved|as (?:satisfied|met)"
            r"|criteria (?:as )?(?:met|satisfied))\b"
            r"|\b(?:state|say|confirm|claim)(?: that)? all (?:coverage )?criteria\b"
        ),
    }.items()
}


def _fold_char(c: str) -> str:
    if unicodedata.category(c) == "Zs":
        return " "
    if ord(c) in _LIGATURES or unicodedata.decomposition(c).startswith(_FOLD_TAGS):
        return unicodedata.normalize("NFKC", c)
    return c


def _remove_invisible(text: str) -> tuple[str, str, list[str]]:
    """(text without invisible characters, text hidden in tag characters, reasons)."""
    reasons = []
    if _BIDI_RE.search(text):
        reasons.append("bidi override characters detected")
    hidden = "".join(chr(ord(c) - _TAG_BASE) for c in _TAG_RE.findall(text))
    if hidden:
        reasons.append("hidden text in unicode tag characters")
    text = _TAG_RE.sub("", _BIDI_RE.sub("", _STRIP_RE.sub("", text)))
    kept = "".join(c for c in text if unicodedata.category(c) != "Cf")
    if kept != text:
        reasons.append("invisible format characters detected")
    return kept, hidden, reasons


def _script(c: str) -> str:
    return unicodedata.name(c, "").split(" ", 1)[0]


def _homoglyph_reason(text: str) -> str:
    for word in _WORD_RE.findall(text):
        if word.isascii():
            continue
        if len({_script(c) for c in word} & _SCRIPTS) > 1:
            return "possible unicode homoglyph substitution (mixed-script word)"
        if len(word) >= 3 and all(c in _LOOKALIKES for c in word):
            return "possible unicode homoglyph substitution (word spelled in look-alike letters)"
    return ""


def _decodes_to_text(token: str) -> bool:
    if len(token) % 4:
        return False
    try:
        raw = base64.b64decode(token, validate=True)
    except (binascii.Error, ValueError):
        return False
    printable = sum(32 <= b < 127 for b in raw)
    return len(raw) >= 16 and printable >= 0.9 * len(raw) and b" " in raw


def _injection_reasons(clean: str, hidden: str) -> list[str]:
    folded = unicodedata.normalize("NFKC", f"{clean}\n{hidden}").casefold()
    found = [name for name, pattern in _INJECTION.items() if pattern.search(folded)]
    if any(_decodes_to_text(t) for t in _BASE64_RE.findall(clean)):
        found.append("encoded text")
    return [f"injection pattern detected: {', '.join(found)}"] if found else []


def sanitize_extracted_text(text: str) -> SanitizeResult:
    """Clean and inspect *text* extracted from an untrusted document.

    Every check runs, so a combined attack (say, bidi override plus an injection phrase)
    reports all of its reasons.
    """
    clean, hidden, reasons = _remove_invisible(text)
    if not clean.isascii():
        clean = "".join(_fold_char(c) for c in clean)
        reasons.append(_homoglyph_reason(clean))
    reasons += _injection_reasons(clean, hidden)
    reason = "; ".join(r for r in reasons if r)
    return SanitizeResult(clean_text=clean, suspicious=bool(reason), reason=reason)


@dataclass
class PhantomLintResult:
    """Outcome of ocr_consistency_check()."""

    has_hidden_content: bool = False
    confidence: float = 0.0
    details: str = ""


_WHITE_FILL_RE = re.compile(r"1(?:\.0*)?\s+1(?:\.0*)?\s+1(?:\.0*)?\s+rg")
# PDF text show operators: Tj (single string), TJ (array), ' and "
_TEXT_SHOW_RE = re.compile(r"\bTj\b|\bTJ\b")


def ocr_consistency_check(pdf_bytes: bytes) -> PhantomLintResult:
    """PhantomLint-style check: detect white (invisible) text in a PDF.

    Inspects the raw PDF content stream for white fill-color operators
    (``1 1 1 rg`` and variants) followed by text-drawing commands. This is
    more reliable across PyMuPDF versions than parsing span color integers
    from the rawdict format.

    Takes raw PDF bytes directly (never spooled to disk) since the input may
    contain PHI.

    Requires PyMuPDF (``fitz``).
    """
    try:
        import fitz  # type: ignore[import]
    except ImportError:
        return PhantomLintResult(
            has_hidden_content=False, confidence=0.0, details="fitz not available"
        )

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    found_hidden = False
    confidence = 0.0
    details = ""

    for page_num in range(len(doc)):
        page = doc[page_num]
        # Read the raw content stream for this page
        try:
            content = page.read_contents().decode("latin-1", errors="replace")
        except Exception as exc:
            # In a security check, a page we cannot inspect is itself a signal —
            # silently skipping it would let a crafted page bypass the scan.
            # Conservative direction: flag for human review rather than pass.
            logger.warning(
                "ocr_consistency_check: page %d content stream unreadable: %s",
                page_num + 1,
                exc,
            )
            found_hidden = True
            confidence = 0.5
            details = f"page {page_num + 1} content stream unreadable"
            break

        if _WHITE_FILL_RE.search(content) and _TEXT_SHOW_RE.search(content):
            # White color was set AND text was drawn — likely hidden content.
            # Additional heuristic: check if the white color appears before
            # a text-show operator in the stream (not just anywhere).
            white_match = _WHITE_FILL_RE.search(content)
            text_match = _TEXT_SHOW_RE.search(content, white_match.start())  # type: ignore[union-attr]
            if text_match:
                found_hidden = True
                confidence = 0.9
                details = f"white fill color + text draw operator on page {page_num + 1}"
                break

    doc.close()

    if found_hidden:
        return PhantomLintResult(has_hidden_content=True, confidence=confidence, details=details)
    return PhantomLintResult(has_hidden_content=False, confidence=0.0)
