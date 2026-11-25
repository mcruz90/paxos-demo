"""Read-only staff review of the two once-daily decisions in the synthetic case."""

import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from cases.dose_fixture import DoseDocuments

Text = Annotated[str, Field(min_length=1, max_length=512)]
# wording to revisit (May)
_FINDING = "{requested} mg requested, {approved} mg approved; limit not in the policy text."
_UNCHECKED = "{requested} mg requested, {approved} mg approved; the policy could not be checked."
_DIRECTIONS = re.compile(
    r"Esomeprazole oral suspension: ([1-9][0-9]{0,2}) mg once daily for [1-9][0-9]{0,2} days"
)
_SILENT_SECTION = re.compile(
    r"(?:<!-- cite: Coverage Criteria — not specified -->\s*)?Not stated\."
)


class DoseCitation(BaseModel):
    locator: Text
    excerpt: Text


class DraftPayerQuestion(BaseModel):
    owner: Literal["assigned case reviewer"] = "assigned case reviewer"
    status: Literal["draft"] = "draft"
    question: Text


class DoseReview(BaseModel):
    status: Literal["staff_review_hold"] = "staff_review_hold"
    synthetic: Literal[True] = True
    finding: Text
    prescription: DoseCitation
    letter: DoseCitation
    policy: DoseCitation | None
    label_status: Literal["current label check pending"] = "current label check pending"
    answer_requires_review: bool
    next_action: DraftPayerQuestion


def dose_review(documents: DoseDocuments | None, applicable_policy: bool) -> DoseReview | None:
    if documents is None:
        return None
    rx = _DIRECTIONS.fullmatch(documents.prescription)
    letter = _DIRECTIONS.fullmatch(documents.letter)
    if not rx or not letter or rx[1] == letter[1]:
        return None
    policy = None
    if applicable_policy and _SILENT_SECTION.fullmatch(documents.policy or ""):
        policy = DoseCitation(locator=documents.policy_locator, excerpt="Not stated.")
    template = _FINDING if policy else _UNCHECKED
    return DoseReview(
        finding=template.format(requested=rx[1], approved=letter[1]),
        prescription=DoseCitation(
            locator=documents.prescription_locator, excerpt=documents.prescription
        ),
        letter=DoseCitation(locator=documents.letter_locator, excerpt=documents.letter),
        policy=policy,
        answer_requires_review=bool(documents.payer_answer),
        next_action=DraftPayerQuestion(
            question=(
                "Please clarify in writing: which plan rule, product strength, units per day "
                f"and effective date support the approved {letter[1]} mg once daily?"
            )
        ),
    )
