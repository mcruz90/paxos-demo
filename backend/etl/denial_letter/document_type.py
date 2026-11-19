"""What kind of document arrived: a deterministic baseline for ClearAuth's missing document-type stage.

    classify(text) -> one of TYPES, or "unknown"

ClearAuth's denial ETL assumes every document is a denial. It isn't: approvals, partial approvals, requests
for more information (pends), appeal decisions, appeal letters that quote a denial, letters of medical
necessity and request forms all arrive too. Reading any of them as a denial puts a patient who was approved,
or a clinic's own appeal, into the denial workflow; missing a real denial loses its appeal deadline.

The rules read how a document frames itself before the words it contains:
1. a payer's decision on an appeal (upheld or overturned);
2. an appeal or request for redetermination, in the sender's own words (a clinic or patient answering a denial,
   often quoting it; a denial's "you may request a redetermination" is not one);
3. a checked decision box ("[X] Denied"), when every checked one agrees;
4. a request form (a title asking for coverage, with check boxes);
5. a letter of medical necessity;
6. a pend (more information needed before a decision);
7. a partial approval (or an approval whose balance is denied);
8. a denial, read with quoted text removed;
9. an approval.
All decision rules read the text without the labels of unchecked boxes. The rules were written against the development
layouts and frozen before held-out set 2 was written; that frozen version is doc_type_v1.py, which set 2's one
comparison uses. This file takes fixes found by tests on other authors' documents (decision 0009, update
2026-10-27). keyword() is the naive reading ("denied" anywhere is a denial) for comparison.
Standard library only, no LLM.
"""

import re

TYPES = (
    "denial",
    "approval",
    "partial_approval",
    "pend",
    "appeal_upheld",
    "appeal_overturned",
    "appeal_letter",
    "lmn",
    "request_form",
)
_I = re.IGNORECASE
QUOTED = re.compile(r"[\"“][^\"”\n]{10,}[\"”]")
APPEAL_REVIEWED = re.compile(
    r"\b(?:reviewed your appeal|your appeal (?:for|of)\b.{0,80}\breviewed|notice of redetermination|appeal decision"
    r"|after review of your appeal|your appeal (?:was|has been|is)|appeal (?:approved|denied|upheld)"
    r"|denial (?:(?:is|was|has been) )?(?:upheld|overturned)"
    # a numbered review level is an appeal's ("Second-level review outcome", "RE: Level 1 appeal"; decision 0047)
    r"|(?:first|second|third)[- ]level (?:review|appeal)|level (?:1|2|3|one|two|three|i|ii|iii) (?:appeal|review)"
    r"|(?:news|decision) (?:about|on) your appeal)\b",
    _I,
)
# Outcome verbs must assert what happened to the appeal/decision, not describe another request.
UPHELD = re.compile(
    r"\b(?:(?:we (?:are )?|and )uphold(?:ing)? (?:our|the) (?:original )?(?:denial|decision|determination)"
    r"|(?:original )?(?:denial|decision) (?:is |was |has been )?(?:upheld|stands)"
    r"|(?:we |and )affirm(?:s|ed|ing)? (?:the|our) (?:original )?(?:denial|decision|determination)"
    r"|agreed with the (?:first|original|earlier|initial) decision|(?:coverage |request )?remains denied"
    r"|appeal (?:was |has been |is )?denied)\b",
    _I,
)
OVERTURNED = re.compile(
    r"\b(?:(?:we (?:have )?|has |have )(?:reversed|overturned|changed) (?:our|the) (?:earlier |original )?"
    r"(?:decision|denial)"
    r"|(?:denial|decision) (?:is |was |has been )?(?:reversed|overturned)"
    r"|appeal (?:is |was |has been )?(?:approved|successful))\b",
    _I,
)
# Plainer overturn wording (decision 0047, "held replies"): asserted only when no condition comes anywhere earlier in
# its sentence, other clauses too ("Once the records arrive, we will have decided in your favor" asserts nothing).
FAVOR = re.compile(
    r"\b(?:decided (?:the appeal )?in your favou?r|(?:earlier |original |previous )?denial no longer applies)\b",
    _I,
)
CONDITION = re.compile(
    r"\b(?:if|unless|whether|once|provided|until|when|may|might|can|could|would|should|not|never|rights?)\b",
    _I,
)
NONASSERTED = re.compile(
    r"\b(?:if|unless|whether|when|may|might|can|could|would|should|not|never|rights?)\b", _I
)
# The sender's own request, in the first person: a payer's denial tells the patient "you may request a
# redetermination", and that rights text must not make it an appeal letter (finding J, 2026-10-27).
APPEALING = re.compile(
    r"\b(?:writing to appeal|appeal the denial|asking you to reconsider"
    r"|do not agree with (?:this|the) (?:decision|denial)"
    r"|(?:I|we)(?: am| are|'m|'re)? (?:writing to |formally |hereby )?request(?:ing)? (?:a |an )?(?:expedited )?"
    r"(?:redetermination|reconsideration|appeal))\b",
    _I,
)
REQUEST_TITLE = re.compile(r"\brequest\b.*\b(?:form|coverage determination)\b|\brequest form\b", _I)
CHECKBOX = re.compile(r"\[[ xX]\]|\([ xX]\)|[☐☒☑]")
# A checked box labelled with a decision decides before a form's title (finding K); an unchecked box's label is
# not read at all (finding E: "[ ] Denied" on an approval made it a denial). A box may be [X], (X), a ballot box, a
# bare X opposite a "_" blank, or "Label: Yes" (XA round 2).
_DECISION = r"partial(?:ly)? approv\w*|approved in part|not approved|approved|denied|pend\w*|appeal overturned|appeal upheld"
_IM = _I | re.MULTILINE
DECISION_BOX = re.compile(
    rf"(?:(?:\[[xX]\]|\([xX]\)|[☒☑])[ \t]*|^[ \t]*X[ \t]+(?=[^\n]*/[ \t]*_ ))(?P<label>{_DECISION})",
    _IM,
)
DECISION_YES = re.compile(rf"\b(?P<label>{_DECISION})[ \t]*:[ \t]*yes\b", _I)
UNCHECKED = re.compile(
    rf"(?:\[ \]|\( \)|☐|(?:^|(?<=/ ))_ )(?:(?!\( \)|\([xX]\)|[☐☒☑])[^\n\[])*|\b(?:{_DECISION})[ \t]*:[ \t]*no\b",
    _IM,
)
LMN = re.compile(r"\bletter of medical necessity\b", _I)
LMN_BODY = re.compile(
    r"\bI am (?:writing|requesting)\b[^\n]*\b(?:coverage|prior authorization)\b", _I
)
PEND = re.compile(
    r"\b(?:request for additional information|need more information|cannot be made until|is pending)\b",
    _I,
)
PARTIAL = re.compile(r"\b(?:partial approval|approved in part|partially approved)\b", _I)
BALANCE_DENIED = re.compile(
    r"\b(?:balance|remainder)\b[^.\n]{0,60}\b(?:is|was|has been) denied\b", _I
)
DENIED = re.compile(
    r"\b(?:denied|not approved|cannot approve|unable to approve|adverse (?:benefit )?determination|denial of|"
    r"does not meet (?:coverage )?criteria|not medically necessary)\b",
    _I,
)
# A denial word the text itself negates is none: "This is not a denial of coverage", "was not denied" (decision
# 0047). Only a negation right before the word counts, so "did not receive the records, so it is denied" stays.
NEGATED_DENIAL = re.compile(r"\b(?:not|never|no)\s+(?:an?\s+)?$", _I)
# A negated approval is a denial: "No renewal was approved." "No approval is needed" and "If no renewal is approved"
# are not (XA round 2).
NEGATED_APPROVAL = re.compile(
    r"\bno (?:\w+ ){1,3}?(?:was|were|is|are|has been|have been) approved\b"
    r"|\bno approval (?:was|is|has been) (?:granted|given|issued)\b"
    r"|\bapproval (?:was|is|has) (?:not|never)(?: been)? (?:granted|given|issued)\b"
    r"|\b(?:not been|never(?: been)?) approved\b|\bdid not approve\b",
    _I,
)
# A polite modal or unrelated negation is not grounds to discard an actual denial.
CONDITIONAL = re.compile(r"\b(?:if|unless|whether)\b", _I)
CONJUNCTION = re.compile(r"\b(?:and|but|so|yet|then)\b", _I)  # A condition reaches only this far.
# "We will explain if you ask why your request has not been approved": the condition is the asking, and "why ..."
# states the fact, so a "why" after the condition ends it (outside review 5, R5-11).
WHY = re.compile(r"\bwhy\b", _I)
APPROVED = re.compile(r"\b(?:approved|approval)\b", _I)
# Coverage stated as a fact with its dates, or an "Authorized" status label (decision 0047, "held replies"). It
# counts only when asserted in its sentence, and when the text refuses coverage nowhere and offers no alternative:
# "We won't cover X. Y is covered from ..." is another drug's coverage, not an approval.
COVERED = re.compile(
    r"\b(?:is covered (?:from|through|until)|will pay for (?:it|this \w+) from"
    r"|your (?:prescription|medicine|request) for [^.\n]{1,60} is covered(?=\.))",
    _I,
)
NOT_COVERED = re.compile(
    r"\b(?:not|isn't|aren't) (?:be )?covered\b"
    r"|\b(?:won't|will not|cannot|can't|does not|doesn't|do not) (?:cover|pay)\b"
    r"|\bnot (?:be )?paid\b|\b(?:instead|alternatives?|preferred)\b",
    _I,
)
STATUS_AUTHORIZED = re.compile(r"^[ \t]*status[ \t]*:[ \t]*(?:authorized|approved)\b", _IM)


def _head(text: str, lines: int = 4) -> str:
    return "\n".join([line for line in text.splitlines() if line.strip()][:lines])


def _asserted(
    pattern: re.Pattern[str], clauses: list[str], words: re.Pattern[str] = NONASSERTED
) -> bool:
    """A match counts unless a rights, modal or negation word comes before it in its clause: "If the denial is
    overturned" asserts nothing, while "the denial is upheld because the criteria were not met" does."""
    return any(not words.search(c[: m.start()]) for c in clauses for m in pattern.finditer(c))


def _appeal_decision(text: str) -> str | None:
    unquoted = QUOTED.sub(" ", text)
    clauses = re.split(r"[.!?;:,\n]", unquoted)
    if not _asserted(APPEAL_REVIEWED, clauses):
        return None
    favor = _asserted(FAVOR, re.split(r"[.!?;\n]", unquoted), CONDITION)
    upheld, overturned = _asserted(UPHELD, clauses), _asserted(OVERTURNED, clauses) or favor
    if upheld != overturned:
        return "appeal_upheld" if upheld else "appeal_overturned"
    return None


def _appeal_framed(text: str) -> bool:
    """The document speaks of an appeal decision or receipt as a fact, whatever the outcome."""
    return _asserted(APPEAL_REVIEWED, re.split(r"[.!?;:,\n]", QUOTED.sub(" ", text)))


def _box_decision(text: str) -> str | None:
    """The decision a checked box records, when every checked decision box says the same."""
    kinds = {
        _box_kind(m["label"].lower())
        for rx in (DECISION_BOX, DECISION_YES)
        for m in rx.finditer(text)
    }
    return kinds.pop() if len(kinds) == 1 else None


def _box_kind(label: str) -> str:
    if label.startswith("appeal"):
        return "appeal_overturned" if label.endswith("overturned") else "appeal_upheld"
    if label.startswith("partial") or label == "approved in part":
        return "partial_approval"
    if label.startswith("pend"):
        return "pend"
    return "denial" if label in ("denied", "not approved") else "approval"


def _is_partial(text: str) -> bool:
    return bool(PARTIAL.search(text) or (BALANCE_DENIED.search(text) and APPROVED.search(text)))


def _is_request_form(text: str) -> bool:
    return bool(REQUEST_TITLE.search(_head(text)) and CHECKBOX.search(text))


def _conditioned(before: str) -> bool:
    """An if/unless/whether since the nearest conjunction covers what follows, unless a "why" comes after it."""
    scope = CONJUNCTION.split(before)[-1]
    conditions = list(CONDITIONAL.finditer(scope))
    return bool(conditions) and not WHY.search(scope, conditions[-1].end())


def _is_denial(text: str) -> bool:
    unquoted = QUOTED.sub(" ", text)
    negated = any(
        not _conditioned(clause[: match.start()])
        for clause in re.split(r"[.!?;:,\n]", unquoted)
        for match in NEGATED_APPROVAL.finditer(clause)
    )
    denied = any(
        not NEGATED_DENIAL.search(unquoted[max(0, m.start() - 12) : m.start()])
        for m in DENIED.finditer(unquoted)
    )
    return denied or negated


def _is_approval(text: str) -> bool:
    unquoted = QUOTED.sub(" ", text)
    sentences = re.split(
        r"[.!?;\n]", unquoted
    )  # a whole sentence: "If ..., your prescription is covered" is not
    covered = _asserted(COVERED, sentences) and not NOT_COVERED.search(unquoted)
    return bool(APPROVED.search(unquoted) or STATUS_AUTHORIZED.search(unquoted) or covered)


def _is_lmn(text: str) -> bool:
    return bool(
        LMN.search(_head(text)) or (LMN_BODY.search(text) and "medically necessary" in text.lower())
    )


# after an appeal decision, an appeal letter, a checked decision box and a request form, in order: the first rule
# that fits decides, reading the text without unchecked boxes' labels
RULES = (
    (_is_lmn, "lmn"),
    (lambda t: bool(PEND.search(t)), "pend"),
    (_is_partial, "partial_approval"),
    (_is_denial, "denial"),
    (_is_approval, "approval"),
)


def classify(text: str) -> str:
    """The document's type, or "unknown" when no rule fits."""
    plain = UNCHECKED.sub(" ", text)
    if decision := _appeal_decision(plain):
        return decision
    if APPEALING.search(QUOTED.sub(" ", plain)):
        return "appeal_letter"
    if boxed := _box_decision(text):
        return boxed
    if _is_request_form(text):  # its check boxes, ticked or not, are what make it a form
        return "request_form"
    if _appeal_framed(plain):
        # An appeal with no single stated outcome may still be pending: a person decides, because reading it as a
        # denial would start a first appeal again (May, 2026-11-06).
        return "unknown"
    return next((kind for fits, kind in RULES if fits(plain)), "unknown")
