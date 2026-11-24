"""Duration findings from the explicitly bound pediatric assessment."""

from dataclasses import replace
from datetime import date
from pathlib import Path
from types import SimpleNamespace

from api.assessment import public_assessment
from cases.assessment_sources import PediatricFixtureReader
from golden_set.seeds import SEEDS
from tests.unit.test_case_readiness import CASE

READER = PediatricFixtureReader(CASE.case_id, CASE.tenant_id, CASE.patient_ref)


def test_bound_assessment_explains_remaining_days_and_separates_sources():
    result = public_assessment(CASE, READER).model_dump(mode="json")
    decision = result.get("duration_approval")
    assert decision, "bound assessment omits the documented partial approval"
    assert (decision["requested_daily_mg"], decision["requested_quantity"]) == (20, 56)
    assert decision["quantity_unit"] == "once-daily doses"
    assert (decision["requested_days"], decision["approved_days"]) == (56, 28)
    assert decision["determination_date"] == "2026-10-28"
    assert "28 of 56 days" in decision["determination_excerpt"]
    assert decision["determination_source"]
    assert decision["finding"] == "Approved duration is shorter than requested."
    assert decision["payer_requirement"] == "Authorization will be issued for 12 months"
    path, line = decision["policy_location"].rsplit(":", 1)
    policy = Path(__file__).resolve().parents[3] / path
    assert (
        policy.read_text(encoding="utf-8").splitlines()[int(line) - 1].strip()
        == (decision["payer_requirement"])
    )
    assert decision["appeal_date"] == "2026-11-03" and decision["upheld_date"] == "2026-11-13"
    assert decision["peer_to_peer_offered"] and decision["label_status"] == "label check pending"
    assert result["ready"] and result["pathway"] == "swallowing"
    assert "remaining 28 days" in result["next_action"]
    assert (
        "confirm" in result["next_action"].lower()
        and "fill date is unknown" in result["next_action"]
    )
    assert decision["fill_date"] is None and decision["supply_end_date"] is None
    assert result["next_action"] == (
        "Pursue the appeal for the remaining 28 days through the offered peer-to-peer review. "
        "The fill date is unknown. Ask staff to confirm it. "
        "Ask the prescriber whether a delay could seriously harm the patient. "
        "If yes, ask the payer for an expedited appeal."
    )


def test_appeal_history_cites_each_seed_field_and_tracks_changes(monkeypatch):
    key = "esomeprazole_uhc_pediatric"
    seed = SEEDS[key]
    data = public_assessment(CASE, READER).model_dump(mode="json")["duration_approval"]
    for field in ("appeal_date", "upheld_date", "peer_to_peer_offered"):
        assert (
            data.get(field + "_source")
            == f"backend/golden_set/seeds.py#SEEDS[{key}].history.{field}"
        )
    history = replace(
        seed.history,
        appeal_date=date(2026, 11, 5),
        upheld_date=date(2026, 11, 16),
        peer_to_peer_offered=False,
    )
    monkeypatch.setitem(SEEDS, key, replace(seed, history=history))
    changed = public_assessment(CASE, READER).model_dump(mode="json")
    assert changed["duration_approval"]["appeal_date"] == "2026-11-05"
    assert changed["duration_approval"]["upheld_date"] == "2026-11-16"
    assert changed["duration_approval"]["peer_to_peer_offered"] is False
    assert "peer-to-peer" not in changed["next_action"]


def test_documented_fill_controls_last_covered_day():
    inputs = READER.read(CASE)
    assert hasattr(inputs, "duration_decision"), "trusted reader omits the duration decision"
    filled = replace(
        inputs.duration_decision, fill_date=date(2026, 11, 4), fill_source="Dispense log"
    )
    result = public_assessment(
        CASE, SimpleNamespace(read=lambda _: replace(inputs, duration_decision=filled))
    )
    assert result.duration_approval.supply_end_date == date(2026, 12, 1)
    assert "2026-12-01" in result.next_action


def test_unbound_and_unmatched_cases_have_no_duration_finding():
    assert (
        public_assessment(CASE, PediatricFixtureReader()).model_dump().get("duration_approval")
        is None
    )
    inputs = READER.read(CASE)
    reader = SimpleNamespace(read=lambda _: replace(inputs, plan_id="unmatched"))
    assert public_assessment(CASE, reader).model_dump().get("duration_approval") is None
