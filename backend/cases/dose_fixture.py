"""Trusted synthetic E-01 records, separate from the duration-dispute anchor."""

from dataclasses import dataclass
from pathlib import Path

POLICY_PATH = "golden/policies/esomeprazole_uhc_pediatric.md"
_POLICY = Path(__file__).resolve().parents[1] / POLICY_PATH
PRESCRIPTION = "Esomeprazole oral suspension: 20 mg once daily for 56 days"
LETTER = "Esomeprazole oral suspension: 10 mg once daily for 56 days"


@dataclass(frozen=True)
class DoseDocuments:
    prescription: str
    letter: str
    policy: str | None
    payer_answer: str | None = None
    prescription_locator: str = "backend/cases/dose_fixture.py#PRESCRIPTION"
    letter_locator: str = "backend/cases/dose_fixture.py#LETTER"
    policy_locator: str = f"backend/{POLICY_PATH}#quantity-limits"


def dose_documents() -> DoseDocuments:
    try:
        text = _POLICY.read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        return DoseDocuments(PRESCRIPTION, LETTER, None)
    header = "## Quantity Limits"
    sections = text.split("\n" + header + "\n")
    section = sections[1].split("\n## ", 1)[0].strip() if len(sections) == 2 else None
    return DoseDocuments(PRESCRIPTION, LETTER, section)
