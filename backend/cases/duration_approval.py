"""Bounded, fixture-backed facts about a post-determination duration dispute."""

import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from golden_set.seeds import SEEDS

_ANCHOR = "esomeprazole_uhc_pediatric"
_HISTORY_SOURCE = f"backend/golden_set/seeds.py#SEEDS[{_ANCHOR}].history"

Days = Annotated[int, Field(ge=1, le=366)]
Text = Annotated[str, Field(min_length=1, max_length=512)]


@dataclass(frozen=True)
class DurationDecision:
    requested_daily_mg: int
    requested_days: int
    approved_days: int
    determination_date: date
    determination_excerpt: str
    appeal_date: date
    upheld_date: date
    peer_to_peer_offered: bool
    fill_date: date | None = None
    fill_source: str | None = None


def pediatric_duration_decision() -> DurationDecision | None:
    """Read the controlled synthetic prescription and letter; hold on disagreement."""
    seed = SEEDS[_ANCHOR]
    rx = re.fullmatch(r"(\d+) mg once daily for (\d+) days", seed.prescription_directions)
    letter = re.fullmatch(
        r"(\d+) of (\d+) days approved at the prescribed (\d+) mg once daily", seed.denial_reason
    )
    if seed.history is None or not seed.partial_approval or not rx or not letter:
        return None
    approved, requested, dose = map(int, letter.groups())
    if (dose, requested) != tuple(map(int, rx.groups())) or not 0 < approved < requested <= 366:
        return None
    return DurationDecision(
        dose,
        requested,
        approved,
        date.fromisoformat(seed.determination_date),
        seed.denial_reason,
        seed.history.appeal_date,
        seed.history.upheld_date,
        seed.history.peer_to_peer_offered,
    )


class DurationApproval(BaseModel):
    requested_daily_mg: int = Field(gt=0, le=1000)
    requested_days: Days
    requested_quantity: Days
    quantity_unit: Literal["once-daily doses"] = "once-daily doses"
    approved_days: Days
    determination_date: date
    determination_excerpt: Text
    determination_source: Text = "Pediatric anchor determination letter, DETERMINATION section"
    request_source: Text = "Pediatric anchor prescription, Directions"
    finding: Literal["Approved duration is shorter than requested."] = (
        "Approved duration is shorter than requested."
    )
    payer_requirement: Text = "Authorization will be issued for 12 months"
    policy_location: Text = "backend/golden/policies/_raw/esomeprazole_uhc_pediatric.txt:86"
    appeal_date: date
    upheld_date: date
    peer_to_peer_offered: bool
    appeal_date_source: Text = f"{_HISTORY_SOURCE}.appeal_date"
    upheld_date_source: Text = f"{_HISTORY_SOURCE}.upheld_date"
    peer_to_peer_offered_source: Text = f"{_HISTORY_SOURCE}.peer_to_peer_offered"
    label_status: Literal["label check pending"] = "label check pending"
    fill_date: date | None
    fill_source: Text | None
    supply_end_date: date | None

    def appeal_action(self) -> str:
        remaining = self.requested_days - self.approved_days
        timing = (
            f"The last covered supply day is {self.supply_end_date.isoformat()}."
            if self.supply_end_date
            else "The fill date is unknown. Ask staff to confirm it."
        )
        review = " through the offered peer-to-peer review" if self.peer_to_peer_offered else ""
        return (
            f"Pursue the appeal for the remaining {remaining} days{review}. {timing} "
            "Ask the prescriber whether a delay could seriously harm the patient. "
            "If yes, ask the payer for an expedited appeal."
        )


def duration_approval(decision: DurationDecision) -> DurationApproval | None:
    if not 0 < decision.approved_days < decision.requested_days <= 366:
        return None
    fill = decision.fill_date if decision.fill_source and decision.fill_source.strip() else None
    return DurationApproval(
        requested_daily_mg=decision.requested_daily_mg,
        requested_quantity=decision.requested_days,
        requested_days=decision.requested_days,
        approved_days=decision.approved_days,
        determination_date=decision.determination_date,
        determination_excerpt=decision.determination_excerpt,
        appeal_date=decision.appeal_date,
        upheld_date=decision.upheld_date,
        peer_to_peer_offered=decision.peer_to_peer_offered,
        fill_date=fill,
        fill_source=decision.fill_source if fill else None,
        supply_end_date=fill + timedelta(days=decision.approved_days - 1) if fill else None,
    )
