"""Policy-resolution regressions for the literal demo request labels."""

from datetime import date

import pytest

from agents.requirements_lookup import resolve_requirements

_AS_OF = date(2026, 11, 19)
_DEMO_REQUESTS = [
    pytest.param(
        "CIGNA-CNF360-2024",
        "Ozempic (semaglutide)",
        "Type 2 Diabetes Mellitus (E11.9)",
        "Ozempic",
        id="ozempic-clinical",
    ),
    pytest.param(
        "CIGNA-CNF360-2024",
        "Ozempic (semaglutide)",
        "Type 2 Diabetes Mellitus (E11.9)",
        "Ozempic",
        id="ozempic-coding",
    ),
    pytest.param(
        "CIGNA-CNF360-2024",
        "Ozempic (semaglutide)",
        "Type 2 Diabetes Mellitus (E11.9)",
        "Ozempic",
        id="ozempic-redteam",
    ),
    pytest.param(
        "CIGNA-CNF877-2024",
        "Livdelzi (seladelpar)",
        "Primary Biliary Cholangitis (PBC) — K74.3",
        "Livdelzi",
        id="livdelzi",
    ),
    pytest.param(
        "UHC-CHOICE-2024",
        "Nexium (esomeprazole) 10mg for Oral Suspension",
        "Gastroesophageal Reflux Disease with Erosive Esophagitis — Pediatric (K21.0)",
        "Nexium suspension",
        id="nexium",
    ),
    pytest.param(
        "CIGNA-IP0652-2026",
        "Humira (adalimumab)",
        "Rheumatoid Arthritis (M05.79)",
        "Humira",
        id="humira",
    ),
]


@pytest.mark.parametrize(("plan", "drug", "diagnosis", "criteria_heading"), _DEMO_REQUESTS)
def test_demo_request_selects_its_own_policy(
    plan: str, drug: str, diagnosis: str, criteria_heading: str
) -> None:
    criteria, resolution = resolve_requirements(plan, drug, diagnosis=diagnosis, as_of=_AS_OF)
    assert resolution == "plan_id", criteria
    assert criteria_heading in criteria.splitlines()[0]


@pytest.mark.parametrize(
    "drug",
    ["Ozempic (semaglutide) 0.5 mg injection", "semaglutide (Ozempic) 0.5mg injection"],
)
def test_brand_and_ingredient_order_with_strength_preserves_formulation(drug: str) -> None:
    _, resolution = resolve_requirements(
        "CIGNA-CNF360-2024", drug, diagnosis="Type 2 Diabetes Mellitus", as_of=_AS_OF
    )
    assert resolution == "plan_id"


_HOLDS = [
    ("CIGNA-CNF360-2024", "Synthetic unrelated product", "E11.9", "product_mismatch"),
    ("CIGNA-CNF360-2024", "Wegovy (semaglutide) 0.5mg injection", "E11.9", "product_mismatch"),
    ("CIGNA-CNF360-2024", "semaglutide 0.5mg injection", "E11.9", "product_mismatch"),
    ("CIGNA-CNF360-2024", "Ozempic (tirzepatide) 0.5mg injection", "E11.9", "product_mismatch"),
    ("UHC-CHOICE-2024", "Nexium (esomeprazole) 10mg capsule", "K21.0", "product_mismatch"),
    ("UHC-CHOICE-2024", "Nexium (esomeprazole) 10mg", "K21.0", "product_mismatch"),
    ("CIGNA-CNF360-2024", "Ozempic", "Type 2 Diabetes Mellitus (E10.9)", "indication_mismatch"),
    (
        "CIGNA-CNF360-2024",
        "Ozempic",
        "Type 2 Diabetes Mellitus (E11.9, E10.9)",
        "indication_mismatch",
    ),
    (
        "UHC-CHOICE-2024",
        "Nexium suspension",
        "GERD with erosive esophagitis (K21.9)",
        "indication_mismatch",
    ),
]


@pytest.mark.parametrize(("plan", "drug", "diagnosis", "reason"), _HOLDS)
def test_normalization_cannot_turn_incompatible_requests_into_matches(
    plan: str, drug: str, diagnosis: str, reason: str
) -> None:
    context, resolution = resolve_requirements(plan, drug, diagnosis=diagnosis, as_of=_AS_OF)
    assert resolution == "generic"
    assert reason in context
    assert "PA Requirements" not in context
